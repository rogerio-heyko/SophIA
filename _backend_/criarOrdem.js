const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const log = require('./logger');

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Configurações da API da Binance Futures
const baseUrl = 'https://fapi.binance.com'; // URL base da API de Futuros da Binance

// Alavancagem
const alavancagem = 50;

// Caminho do arquivo de ordem
const ORDEM_FILE = path.join(__dirname, 'ordem.json');

// Verifica se o processo já está rodando
if (global.criarOrdemIniciado) {
    console.log('criarOrdem.js já está em execução. Ignorando nova instância.');
    process.exit(0);
}
global.criarOrdemIniciado = true;

log('ordem', 'Sistema de criação de ordens iniciado - Monitorando arquivo ordem.json');

// Função para obter as credenciais de uma conta
function obterCredenciaisConta(conta) {
    const apiKey = process.env[`${conta}_APIKEY`];
    const apiSecret = process.env[`${conta}_APISECRET`];

    if (!apiKey || !apiSecret) {
        console.error(`Credenciais da conta ${conta} não encontradas no arquivo .env.`);
        return null;
    }

    return { apiKey, apiSecret };
}

// Função para obter o saldo em USDT de uma conta
async function obterSaldoUSDT(apiKey, apiSecret) {
    const endpoint = '/fapi/v2/account';
    const url = `${baseUrl}${endpoint}`;
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');

    try {
        const response = await axios.get(url, {
            params: { timestamp, signature },
            headers: { 'X-MBX-APIKEY': apiKey }
        });

        const saldoUSDT = response.data.assets.find(asset => asset.asset === 'USDT').walletBalance;
        return parseFloat(saldoUSDT);
    } catch (error) {
        console.error('Erro ao obter saldo da conta:', error.response ? error.response.data : error.message);
        return 0;
    }
}

// Função para obter o preço atual de um par de moedas
async function obterPrecoAtual(symbol) {
    const endpoint = '/fapi/v1/ticker/price';
    const url = `${baseUrl}${endpoint}`;
    const params = { symbol };

    try {
        const response = await axios.get(url, { params });
        return parseFloat(response.data.price);
    } catch (error) {
        console.error(`Erro ao obter preço atual para ${symbol}:`, error.message);
        return null;
    }
}

// Função para verificar se há posições abertas no par de moedas
async function verificarPosicoesAbertas(symbol, apiKey, apiSecret) {
    const endpoint = '/fapi/v2/positionRisk';
    const url = `${baseUrl}${endpoint}`;
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');

    try {
        const response = await axios.get(url, {
            params: { timestamp, signature },
            headers: { 'X-MBX-APIKEY': apiKey }
        });

        // Procura por posições abertas no par de moedas especificado
        const posicao = response.data.find(pos => pos.symbol === symbol && parseFloat(pos.positionAmt) !== 0);
        if (posicao) {
            log('ordem', `Posição aberta encontrada para ${symbol}: ${posicao.positionAmt}`);
            return true; // Há uma posição aberta
        }

        log('ordem', `Nenhuma posição aberta encontrada para ${symbol}.`);
        return false; // Não há posições abertas
    } catch (error) {
        console.error('Erro ao verificar posições abertas:', error.response ? error.response.data : error.message);
        return false;
    }
}

// Função para obter as regras de precisão do símbolo
async function obterPrecisaoSymbol(symbol, apiKey, apiSecret) {
    const endpoint = '/fapi/v1/exchangeInfo';
    const url = `${baseUrl}${endpoint}`;
    const params = { symbol };

    try {
        const response = await axios.get(url, { params });
        const symbolInfo = response.data.symbols.find(s => s.symbol === symbol);

        // Extrai o filtro LOT_SIZE
        const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
        const stepSize = parseFloat(lotSizeFilter.stepSize); // Precisão da quantidade
        const minQty = parseFloat(lotSizeFilter.minQty); // Quantidade mínima
        const maxQty = parseFloat(lotSizeFilter.maxQty); // Quantidade máxima

        return { stepSize, minQty, maxQty };
    } catch (error) {
        console.error(`Erro ao obter precisão para ${symbol}:`, error.message);
        return null;
    }
}

// Função para ajustar a quantidade de acordo com a precisão
function ajustarQuantidade(quantity, stepSize) {
    const precision = Math.log10(1 / stepSize); // Calcula o número de casas decimais
    const adjustedQuantity = Math.floor(quantity / stepSize) * stepSize; // Arredonda para a precisão correta
    return parseFloat(adjustedQuantity.toFixed(precision)); // Retorna a quantidade ajustada
}

// Função para criar uma ordem na Binance Futures
async function createOrder(orderDetails, apiKey, apiSecret) {
    const endpoint = '/fapi/v1/order';
    const url = `${baseUrl}${endpoint}`;

    // Obtém as regras de precisão do símbolo
    const precisaoSymbol = await obterPrecisaoSymbol(orderDetails.symbol, apiKey, apiSecret);
    if (!precisaoSymbol) {
        throw new Error('Não foi possível obter as regras de precisão do símbolo.');
    }

    // Ajusta a quantidade de acordo com a precisão
    const quantidadeAjustada = ajustarQuantidade(orderDetails.quantity, precisaoSymbol.stepSize);

    // Verifica se a quantidade está dentro dos limites permitidos
    if (quantidadeAjustada < precisaoSymbol.minQty || quantidadeAjustada > precisaoSymbol.maxQty) {
        throw new Error(`Quantidade fora dos limites permitidos: minQty=${precisaoSymbol.minQty}, maxQty=${precisaoSymbol.maxQty}`);
    }

    const params = {
        symbol: orderDetails.symbol,
        side: orderDetails.side,
        type: orderDetails.type,
        quantity: quantidadeAjustada,
        timestamp: Date.now(),
        reduceOnly: false // Garante que a ordem não seja do tipo reduceOnly
    };

    const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');

    params.signature = signature;

    try {
        const response = await axios.post(url, null, {
            params: params,
            headers: {
                'X-MBX-APIKEY': apiKey,
            },
        });

        log('ordem', 'Ordem criada com sucesso:', response.data);
        return response.data;
    } catch (error) {
        console.error('Erro ao criar a ordem:', error.response ? error.response.data : error.message);
        throw error; // Lança o erro para ser tratado externamente
    }
}

// Função para monitorar o arquivo JSON e criar a ordem (versão legacy - será removida)
// Esta função foi substituída pela função monitorarArquivoOrdem() mais robusta

// Função para obter todas as contas configuradas no .env
function obterContas() {
    const contas = [];
    const envKeys = Object.keys(process.env);
    
    // Procura por padrões de API_KEY no .env
    envKeys.forEach(key => {
        if (key.endsWith('_APIKEY')) {
            const conta = key.replace('_APIKEY', '');
            contas.push(conta);
        }
    });
    
    return contas;
}

// Função para processar uma nova ordem
async function processarOrdem(orderDetails) {
    try {
        log('ordem', `Processando nova ordem: ${orderDetails.side} ${orderDetails.symbol}`);
        
        // Obtém todas as contas configuradas
        const contas = obterContas();
        if (contas.length === 0) {
            log('ordem', 'Nenhuma conta encontrada no arquivo .env.');
            return;
        }

        // Itera sobre todas as contas definidas no arquivo .env
        for (const conta of contas) {
            const credenciais = obterCredenciaisConta(conta);
            if (!credenciais) continue;

            // Verifica se há posições abertas no par de moedas
            const posicaoAberta = await verificarPosicoesAbertas(orderDetails.symbol, credenciais.apiKey, credenciais.apiSecret);
            if (posicaoAberta) {
                log('ordem', `Já existe uma posição aberta para ${orderDetails.symbol} na conta ${conta}. Ordem ignorada.`);
                continue;
            }

            // Obtém o saldo em USDT da conta
            const saldoUSDT = await obterSaldoUSDT(credenciais.apiKey, credenciais.apiSecret);
            if (saldoUSDT <= 0) {
                log('ordem', `Saldo insuficiente na conta ${conta}. Ordem ignorada.`);
                continue;
            }

            // Calcula a quantidade base (1% do saldo em USDT)
            const quantidadeBase = saldoUSDT * 0.01;

            // Obtém o preço atual do par de moedas
            const precoAtual = await obterPrecoAtual(orderDetails.symbol);
            if (!precoAtual) continue;

            // Calcula a quantidade do base asset com alavancagem
            const valorTotal = quantidadeBase * alavancagem; // Valor total com alavancagem
            const quantidadeBaseAsset = valorTotal / precoAtual;

            // Obtém as regras de precisão do símbolo
            const precisaoSymbol = await obterPrecisaoSymbol(orderDetails.symbol, credenciais.apiKey, credenciais.apiSecret);
            if (!precisaoSymbol) continue;

            // Ajusta a quantidade para a precisão correta
            const quantidadeAjustada = ajustarQuantidade(quantidadeBaseAsset, precisaoSymbol.stepSize);

            log('ordem', `Criando ordem para a conta ${conta}: ${orderDetails.side} ${quantidadeAjustada} ${orderDetails.symbol}`);
            
            const resultado = await createOrder({
                ...orderDetails,
                quantity: quantidadeAjustada
            }, credenciais.apiKey, credenciais.apiSecret);

            if (resultado) {
                log('ordem', `Ordem criada com sucesso na conta ${conta}: ${resultado.orderId}`);
            }
        }
    } catch (error) {
        log('ordem', `Erro ao processar ordem: ${error.message}`);
    }
}

// Função para monitorar alterações no arquivo ordem.json
function monitorarArquivoOrdem() {
    let ultimaModificacao = null;

    // Verifica se o arquivo existe
    if (!fs.existsSync(ORDEM_FILE)) {
        log('ordem', `Arquivo ${ORDEM_FILE} não encontrado. Criando arquivo vazio...`);
        fs.writeFileSync(ORDEM_FILE, JSON.stringify({}, null, 2));
    }

    // Monitora alterações no arquivo
    fs.watchFile(ORDEM_FILE, { interval: 1000 }, async (curr, prev) => {
        // Verifica se houve uma modificação real
        if (curr.mtime.getTime() !== ultimaModificacao) {
            ultimaModificacao = curr.mtime.getTime();
            
            try {
                // Lê o conteúdo do arquivo
                const conteudo = fs.readFileSync(ORDEM_FILE, 'utf8');
                if (!conteudo.trim()) return; // Ignora arquivo vazio

                const orderDetails = JSON.parse(conteudo);
                
                // Verifica se contém os campos obrigatórios
                if (orderDetails.symbol && orderDetails.side && orderDetails.type) {
                    log('ordem', `Detectada alteração no arquivo ordem.json - Processando ordem...`);
                    await processarOrdem(orderDetails);
                    
                    // Limpa o arquivo após processar
                    fs.writeFileSync(ORDEM_FILE, JSON.stringify({}, null, 2));
                    log('ordem', 'Arquivo ordem.json limpo após processamento.');
                } else {
                    log('ordem', 'Arquivo ordem.json não contém campos obrigatórios (symbol, side, type).');
                }
            } catch (error) {
                log('ordem', `Erro ao processar arquivo ordem.json: ${error.message}`);
            }
        }
    });

    log('ordem', `Monitoramento do arquivo ${ORDEM_FILE} iniciado.`);
}

// Inicia o monitoramento
monitorarArquivoOrdem();

// Mantém o processo ativo
process.on('SIGINT', () => {
    log('ordem', 'Sistema de criação de ordens sendo encerrado...');
    fs.unwatchFile(ORDEM_FILE);
    process.exit(0);
});

// Log para indicar que o serviço está rodando
setInterval(() => {
    // Log silencioso a cada 30 minutos para indicar que está ativo
    log('ordem', 'Sistema de criação de ordens ativo - Aguardando alterações no ordem.json');
}, 30 * 60 * 1000);

log('ordem', 'Sistema de criação de ordens totalmente inicializado.');
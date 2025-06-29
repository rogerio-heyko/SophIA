const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const dotenv = require('dotenv');
const log = require('./logger');

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Configurações da API da Binance Futures
const baseUrl = 'https://fapi.binance.com'; // URL base da API de Futuros da Binance

// Alavancagem
const alavancagem = 50;

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

// Função para monitorar o arquivo JSON e criar a ordem
async function monitorarArquivoJSON() {
    fs.watchFile('C:/sophiaTest/ordem.json', async (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
            log('ordem', 'Arquivo JSON alterado. Lendo...');

            try {
                const data = fs.readFileSync('C:/sophiaTest/ordem.json', 'utf8');
                const orderDetails = JSON.parse(data);

                // Extrai as contas do arquivo .env
                const contas = Object.keys(process.env)
                    .filter(key => key.endsWith('_APIKEY'))
                    .map(key => key.replace('_APIKEY', ''));

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

                    log('ordem', `Criando ordem para a conta ${conta}:`, {
                        ...orderDetails,
                        quantity: quantidadeAjustada
                    });
                    await createOrder({
                        ...orderDetails,
                        quantity: quantidadeAjustada
                    }, credenciais.apiKey, credenciais.apiSecret);
                }
            } catch (error) {
                console.error('Erro ao ler ou processar o arquivo JSON:', error.message);
            }
        }
    });
}

// Inicia o monitoramento do arquivo JSON
monitorarArquivoJSON();
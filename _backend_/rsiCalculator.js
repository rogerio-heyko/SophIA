// rsiCalculator.js módulo auxiliar do monitorarPosicoes.js
const { obterUltimos14Fechamentos } = require('./auth');
const { fecharPosicao } = require('./tradeManager');
const log = require('./logger');

// Função para calcular o RSI manualmente
function calcularRSIManual(fechamentos, period = 14) {
    let ganhos = 0;
    let perdas = 0;

    for (let i = 1; i < fechamentos.length; i++) {
        const diferenca = fechamentos[i] - fechamentos[i - 1];
        if (diferenca > 0) {
            ganhos += diferenca;
        } else {
            perdas += Math.abs(diferenca);
        }
    }

    // Evita divisão por zero
    if (perdas === 0) {
        return 100; // RSI máximo se não houver perdas
    }

    const rs = ganhos / perdas;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
}

// Função para calcular o RSI
async function calcularRSI(symbol, conta, posicoes, precosEntrada, credenciais) {
    // Verifica se a posição ainda está ativa
    if (!posicoes[symbol]) {
        log('monitorar', `Posição para ${symbol} já foi fechada. Parando análise do RSI.`);
        return;
    }

    // Log indicando que o RSI está sendo calculado
    log('monitorar', `Calculando RSI para ${symbol} na conta ${conta}...`);

    // Obtém os últimos 14 preços de fechamento do gráfico de 5 minutos
    const fechamentos = await obterUltimos14Fechamentos(symbol);
    if (!fechamentos || fechamentos.length < 14) {
        log('monitorar', `Não foi possível obter os últimos 14 fechamentos para ${symbol}.`);
        return;
    }

    // Log dos valores obtidos
    log('monitorar', `Preços de fechamento obtidos para ${symbol}:`, fechamentos);

    // Verifica se todos os valores são válidos
    if (fechamentos.some(valor => isNaN(valor) || valor <= 0)) {
        log('monitorar', `Valores inválidos no array de fechamentos para ${symbol}.`);
        return;
    }

    try {
        // Calcula o RSI manualmente
        const rsi = calcularRSIManual(fechamentos);

        // Verifica se o RSI foi calculado corretamente
        if (isNaN(rsi)) {
            log('monitorar', `Não foi possível calcular o RSI para ${symbol}. Dados de entrada:`, fechamentos);
            return;
        }

        // Log do resultado do cálculo do RSI
        log('monitorar', `Resultado do cálculo do RSI para ${symbol}:`, rsi);

        if (rsi !== undefined && !isNaN(rsi)) {
            log('monitorar', `Novo RSI calculado para ${symbol} na conta ${conta}: ${rsi.toFixed(2)}`);

            // Verifica se o RSI atingiu o valor de fechamento
            if (
                (posicoes[symbol].side === 'BUY' && rsi >= 65) ||
                (posicoes[symbol].side === 'SELL' && rsi <= 35)
            ) {
                log('monitorar', `RSI atingiu o valor de fechamento para ${symbol} na conta ${conta}. Fechando posição...`);
                try {
                    const resultadoFechamento = await fecharPosicao(symbol, posicoes[symbol].side, posicoes[symbol].quantity, credenciais.apiKey, credenciais.apiSecret);

                    // Calcula o resultado da operação
                    const precoEntrada = precosEntrada[symbol];
                    const precoSaida = fechamentos[fechamentos.length - 1];
                    const lucro = (precoSaida - precoEntrada) * posicoes[symbol].quantity;
                    log('monitorar', `RESULTADO da operação para ${symbol}: ${lucro.toFixed(2)} USDT`);

                    // Remove a posição após o fechamento
                    delete posicoes[symbol];
                    delete precosEntrada[symbol];

                    log('monitorar', `Posição para ${symbol} fechada. Parando análise do RSI.`);
                } catch (error) {
                    log('monitorar', `Erro ao fechar posição para ${symbol}:`, error.message);
                }
            }
        } else {
            log('monitorar', `Valor do RSI inválido para ${symbol} na conta ${conta}.`);
        }
    } catch (error) {
        log('monitorar', `Erro ao calcular o RSI para ${symbol}:`, error.message);
    }
}

module.exports = { calcularRSI };
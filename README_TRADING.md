# 🚀 SophIA - Sistema de Trading Automatizado

Sistema completo de trading automatizado com análise técnica, criação de ordens e monitoramento de posições em tempo real.

## 📋 Estrutura do Sistema

### **Backend (_backend_/)**
- **server.js** - API REST principal
- **analiseTecnica.js** - Análise técnica contínua dos pares de moedas
- **criarOrdem.js** - Monitoramento do arquivo `ordem.json` e criação automática de ordens
- **monitorarPosicoes.js** - Monitoramento de posições via WebSocket
- **logger.js** - Sistema de logs centralizado
- **auth.js** - Gerenciamento de credenciais
- **positionManager.js** - Gestão avançada de posições

### **Frontend (__frontend__/)**
- **index.js** - Servidor web com logs em tempo real
- **public/index.html** - Interface web responsiva

## 🔧 Como Funciona

### **1. Análise Técnica** (`analiseTecnica.js`)
- Executa análise técnica contínua dos pares configurados
- Verifica tendências usando médias móveis em múltiplos timeframes
- Quando encontra oportunidade, gera o arquivo `analisarOrdem.json`
- Log de heartbeat a cada 5 minutos

### **2. Criação de Ordens** (`criarOrdem.js`)
- Monitora alterações no arquivo `ordem.json`
- Quando detecta mudanças, processa automaticamente a ordem
- Verifica posições abertas, saldo e calcula quantidades
- Limpa o arquivo após processar
- Log de status a cada 30 minutos

### **3. Monitoramento de Posições** (`monitorarPosicoes.js`)
- Conecta via WebSocket à Binance para monitoramento em tempo real
- Implementa stop loss (-2%) e take profit (+3%) automáticos
- Reconexão automática em caso de falha
- Suporte a múltiplas contas

### **4. Interface Web** (Frontend)
- Autenticação básica (login: `vested`, senha: `@Jesus100%@`)
- Logs em tempo real via Server-Sent Events (SSE)
- 3 seções dedicadas: Análise, Ordens, Monitoramento
- Design responsivo e moderno

## 🚀 Executando o Sistema

### **1. Configurar Variáveis de Ambiente**
```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

### **2. Iniciar com Docker Compose**
```bash
docker-compose up -d
```

### **3. Acessar a Interface**
- URL: http://localhost:3000
- Login: `vested`
- Senha: `@Jesus100%@`

## 📊 Portas dos Serviços

| Serviço | Porta | Descrição |
|---------|--------|-----------|
| Frontend | 3000 | Interface web |
| Backend | 4000 | API REST |
| PostgreSQL | 5432 | Banco de dados |
| N8N | 5678 | Automação |
| Qdrant | 6333 | Banco vetorial |
| Ollama | 11434 | IA local |

## 🔄 Fluxo de Operação

1. **Análise** → `analiseTecnica.js` analisa mercado continuamente
2. **Oportunidade** → Gera `analisarOrdem.json` com recomendação
3. **Automação Externa** → Processa recomendação e atualiza `ordem.json`
4. **Execução** → `criarOrdem.js` detecta mudança e executa ordem
5. **Monitoramento** → `monitorarPosicoes.js` acompanha posição em tempo real

## 📝 Arquivos de Configuração

### **ordem.json** (Entrada de Ordens)
```json
{
    "side": "BUY",
    "symbol": "BTCUSDT",
    "type": "MARKET"
}
```

### **analisarOrdem.json** (Saída da Análise)
```json
{
    "side": "SELL",
    "symbol": "ETHUSDT",
    "type": "MARKET"
}
```

## ⚙️ Scripts Disponíveis

### **Backend**
```bash
npm run dev      # Executa todos os serviços com concurrently
npm run start    # Execução em produção
npm run server   # Apenas API
npm run analise  # Apenas análise técnica
npm run ordem    # Apenas criação de ordens
npm run monitor  # Apenas monitoramento
```

### **Frontend**
```bash
npm run dev      # Desenvolvimento com nodemon
npm run start    # Produção
```

## 🔒 Segurança

- Autenticação básica no frontend
- Credenciais da Binance via variáveis de ambiente
- Validação de saldo e posições antes de operar
- Logs detalhados de todas as operações

## 🎯 Recursos Implementados

- ✅ Análise técnica multi-timeframe
- ✅ Detecção automática de oportunidades
- ✅ Criação automática de ordens
- ✅ Monitoramento em tempo real
- ✅ Stop loss e take profit automáticos
- ✅ Interface web moderna
- ✅ Logs em tempo real
- ✅ Suporte a múltiplas contas
- ✅ Reconexão automática
- ✅ Gestão de risco integrada

## 🛠️ Tecnologias Utilizadas

- **Node.js 20** - Runtime JavaScript
- **Express.js** - Framework web
- **WebSocket** - Comunicação em tempo real
- **Docker** - Containerização
- **PostgreSQL** - Banco de dados
- **Concurrently** - Execução paralela
- **Nodemon** - Hot reload
- **Axios** - Cliente HTTP
- **Server-Sent Events** - Logs em tempo real

---

**Versão**: 1.0.0  
**Autor**: SophIA Team  
**Licença**: ISC

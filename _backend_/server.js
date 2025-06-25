const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Configuração do banco PostgreSQL
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: 5432,
});

// Middleware
app.use(cors());
app.use(express.json());

// Middleware de log
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rota de saúde
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'SophIA Backend'
  });
});

// Rota principal
app.get('/', (req, res) => {
  res.json({
    message: '🚀 SophIA Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      database: '/api/db/status',
      ollama: '/api/ollama/status',
      qdrant: '/api/qdrant/status'
    }
  });
});

// Rota para testar conexão com banco
app.get('/api/db/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({
      status: 'connected',
      database: 'PostgreSQL',
      current_time: result.rows[0].current_time
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'PostgreSQL',
      error: error.message
    });
  }
});

// Rota para testar conexão com Ollama
app.get('/api/ollama/status', async (req, res) => {
  try {
    const ollamaHost = process.env.OLLAMA_HOST || 'ollama:11434';
    res.json({
      status: 'configured',
      host: ollamaHost,
      message: 'Ollama está configurado (teste de conexão pode ser implementado)'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Rota para testar conexão com Qdrant
app.get('/api/qdrant/status', async (req, res) => {
  try {
    const qdrantHost = process.env.QDRANT_HOST || 'qdrant';
    res.json({
      status: 'configured',
      host: qdrantHost,
      message: 'Qdrant está configurado (teste de conexão pode ser implementado)'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Algo deu errado!',
    message: err.message
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.originalUrl
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server rodando na porta ${PORT}`);
  console.log(`📁 Diretório de trabalho: ${__dirname}`);
  console.log(`🗄️  Banco PostgreSQL: ${process.env.POSTGRES_HOST || 'postgres'}`);
  console.log(`🤖 Ollama: ${process.env.OLLAMA_HOST || 'ollama:11434'}`);
  console.log(`🔍 Qdrant: ${process.env.QDRANT_HOST || 'qdrant'}`);
});

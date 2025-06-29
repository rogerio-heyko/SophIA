const axios = require('axios');

// Função para enviar logs ao index.js
function log(tipo, mensagem) {
    console.log(`Enviando log: Tipo=${tipo}, Mensagem=${mensagem}`); // Debug

    // Envia o log para o index.js
    axios.post(`http://localhost:3000/log/${tipo}`, { mensagem })
        .then(response => {
            console.log('Log enviado com sucesso:', response.data);
        })
        .catch(error => {
            console.error('Erro ao enviar log:', error.message);
        });
}

module.exports = log;
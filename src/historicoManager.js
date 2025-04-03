// Módulo para gerenciar o histórico de mensagens (carregamento e salvamento)

const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./utils');

// Configurações do histórico
const HISTORICO_DIR = process.env.HISTORICO_DIR || './Histórico';
const HISTORICO_FILE = process.env.HISTORICO_FILE || './Histórico/historico.json';

// Garantir que o diretório do histórico exista
function garantirDiretorioHistorico() {
  if (!fs.existsSync(HISTORICO_DIR)) {
    fs.mkdirSync(HISTORICO_DIR, { recursive: true });
    logger.info(`Diretório de histórico criado: ${HISTORICO_DIR}`);
  }
  
  if (!fs.existsSync(HISTORICO_FILE)) {
    fs.writeFileSync(HISTORICO_FILE, JSON.stringify({
      ultimaAtualizacao: new Date().toISOString(),
      mensagens: []
    }, null, 2));
    logger.info(`Arquivo de histórico criado: ${HISTORICO_FILE}`);
  }
}

// Carregar o histórico de mensagens
function carregarHistorico() {
  try {
    garantirDiretorioHistorico();
    
    // Verificar se o arquivo existe e tem conteúdo válido
    if (fs.existsSync(HISTORICO_FILE)) {
      const conteudo = fs.readFileSync(HISTORICO_FILE, 'utf8');
      if (conteudo && conteudo.trim()) {
        try {
          // Tenta parsear como o formato esperado
          const historico = JSON.parse(conteudo);
          
          // Verificar se está no formato antigo (array)
          if (Array.isArray(historico)) {
            logger.info('Detectado formato antigo do histórico, convertendo para o novo formato...');
            
            // Converter para o novo formato
            const novoHistorico = {
              ultimaAtualizacao: new Date().toISOString(),
              mensagens: historico.map(item => {
                // Extrair o versículo da string "verse"
                let texto = '';
                let referencia = '';
                
                if (item.verse) {
                  const match = item.verse.match(/\"(.+?)\".*?\((.*?)\)/);
                  if (match && match.length >= 3) {
                    texto = match[1].trim();
                    referencia = match[2].trim();
                  }
                }
                
                return {
                  data: item.date,
                  devocional: item.verse || '',
                  versiculo: {
                    texto: texto,
                    referencia: referencia
                  },
                  totalContatos: 0,
                  enviosComSucesso: 0,
                  timestamp: new Date().toISOString()
                };
              })
            };
            
            // Salvar no novo formato
            fs.writeFileSync(HISTORICO_FILE, JSON.stringify(novoHistorico, null, 2));
            logger.info('Arquivo de histórico convertido para o novo formato');
            
            return novoHistorico;
          }
          
          // Garantir que o objeto tem a estrutura esperada
          if (!historico.mensagens) {
            historico.mensagens = [];
          }
          
          return historico;
        } catch (erroParseJson) {
          logger.error(`Erro ao processar JSON do histórico: ${erroParseJson.message}`);
        }
      }
    }
    
    // Se o arquivo não existir, estiver vazio ou não tiver a estrutura esperada
    const historicoVazio = {
      ultimaAtualizacao: new Date().toISOString(),
      mensagens: []
    };
    
    // Salvar o histórico vazio para garantir consistência
    fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historicoVazio, null, 2));
    
    return historicoVazio;
  } catch (erro) {
    logger.error(`Erro ao carregar histórico: ${erro.message}`);
    
    // Retornar um histórico vazio em caso de erro
    const historicoVazio = {
      ultimaAtualizacao: new Date().toISOString(),
      mensagens: []
    };
    
    // Tentar salvar o histórico vazio
    try {
      fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historicoVazio, null, 2));
    } catch (erroSalvar) {
      logger.error(`Erro ao salvar histórico vazio: ${erroSalvar.message}`);
    }
    
    return historicoVazio;
  }
}

// Salvar o histórico de mensagens
function salvarHistorico(historico) {
  try {
    garantirDiretorioHistorico();
    
    // Atualizar a data da última atualização
    historico.ultimaAtualizacao = new Date().toISOString();
    
    // Para debug
    logger.info(`Salvando histórico com ${historico.mensagens.length} mensagens`);
    
    fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historico, null, 2));
    logger.info('Histórico salvo com sucesso');
    
    return true;
  } catch (erro) {
    logger.error(`Erro ao salvar histórico: ${erro.message}`);
    return false;
  }
}

module.exports = {
  garantirDiretorioHistorico,
  carregarHistorico,
  salvarHistorico
};
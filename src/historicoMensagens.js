// Módulo para gerenciamento do histórico de mensagens enviadas (Refatorado)

const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./utils');
const historicoManager = require('./historicoManager');

// Configurações do histórico
const MAX_HISTORICO_DIAS = parseInt(process.env.MAX_HISTORICO_DIAS || '90', 10);

// Limpar mensagens antigas do histórico
function limparHistoricoAntigo(historico) {
  try {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - MAX_HISTORICO_DIAS);
    
    const mensagensRecentes = historico.mensagens.filter(msg => {
      const dataMensagem = new Date(msg.data);
      return dataMensagem >= dataLimite;
    });
    
    const mensagensRemovidas = historico.mensagens.length - mensagensRecentes.length;
    
    if (mensagensRemovidas > 0) {
      logger.info(`Removidas ${mensagensRemovidas} mensagens antigas do histórico`);
      historico.mensagens = mensagensRecentes;
      historicoManager.salvarHistorico(historico);
    }
    
    return historico;
  } catch (erro) {
    logger.error(`Erro ao limpar histórico antigo: ${erro.message}`);
    return historico;
  }
}

// Extrair versículos de uma mensagem devocional
function extrairVersiculo(devocional) {
  try {
    if (!devocional) {
      logger.warn('Tentativa de extrair versículo de um devocional vazio ou nulo');
      return null;
    }
    
    // Procurar o padrão de versículo na mensagem (melhorado para capturar mais formatos)
    const regexVersiculo = /(?:Versículo|Vers[ií]culo|\*Versículo\*|📖.*?Vers[ií]culo):\s*[\"'](.+?)[\"']\s*\((.+?)\)/i;
    const match = devocional.match(regexVersiculo);
    
    if (match && match.length >= 3) {
      logger.info(`Versículo extraído com sucesso: "${match[1]}" (${match[2]})`);
      return {
        texto: match[1].trim(),
        referencia: match[2].trim()
      };
    }
    
    logger.warn(`Não foi possível extrair versículo do texto: "${devocional.substring(0, 100)}..."`);
    return null;
  } catch (erro) {
    logger.error(`Erro ao extrair versículo: ${erro.message}`);
    return null;
  }
}

// Registrar um envio no histórico
function registrarEnvio(dados) {
  try {
    // Usar o historicoManager para carregar o histórico
    const historico = historicoManager.carregarHistorico();
    
    // Extrair informações do versículo do devocional
    const versiculo = extrairVersiculo(dados.devocional);
    
    if (versiculo) {
      logger.info(`Versículo encontrado para registro: ${versiculo.referencia}`);
    } else {
      logger.warn('Nenhum versículo encontrado no devocional para registro');
    }
    
    // Adicionar nova entrada ao histórico
    historico.mensagens.push({
      data: dados.data,
      devocional: dados.devocional,
      versiculo: versiculo,
      totalContatos: dados.totalContatos,
      enviosComSucesso: dados.enviosComSucesso,
      timestamp: new Date().toISOString()
    });
    
    // Limpar mensagens antigas antes de salvar
    limparHistoricoAntigo(historico);
    
    // Salvar o histórico atualizado
    historicoManager.salvarHistorico(historico);
    
    logger.info('Envio registrado no histórico com sucesso');
    return true;
  } catch (erro) {
    logger.error(`Erro ao registrar envio no histórico: ${erro.message}`);
    return false;
  }
}

// Obter versículos usados recentemente (para evitar repetições)
function obterVersiculosRecentes(dias = 7) {
  try {
    // Usar o historicoManager para carregar o histórico
    const historico = historicoManager.carregarHistorico();
    
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);

    // Adicionar log para debug
    logger.info(`Verificando versículos usados nos últimos ${dias} dias`);
    logger.info(`Histórico contém ${historico.mensagens.length} mensagens no total`);
    
    const versiculosRecentes = [];
    
    for (const msg of historico.mensagens) {
      try {
        if (!msg.data || !msg.versiculo) continue;
        
        // Converter a data do formato brasileiro "D de MMMM de YYYY" ou usar o timestamp
        let dataMensagem;
        if (msg.timestamp) {
          dataMensagem = new Date(msg.timestamp);
        } else {
          // Tentar converter a data no formato brasileiro
          const partes = msg.data.match(/(\d+) de (\w+) de (\d+)/);
          if (partes && partes.length >= 4) {
            const meses = {"janeiro":0, "fevereiro":1, "março":2, "abril":3, "maio":4, "junho":5, 
                           "julho":6, "agosto":7, "setembro":8, "outubro":9, "novembro":10, "dezembro":11};
            dataMensagem = new Date(
              parseInt(partes[3]),  // Ano
              meses[partes[2].toLowerCase()], // Mês
              parseInt(partes[1])   // Dia
            );
          } else {
            // Se não conseguir converter, usar a data atual
            logger.warn(`Não foi possível converter a data: ${msg.data}`);
            dataMensagem = new Date();
          }
        }
        
        const isRecente = dataMensagem >= dataLimite;
        
        // Log detalhado para cada mensagem recente
        if (isRecente && msg.versiculo && msg.versiculo.referencia) {
          logger.info(`Versículo recente encontrado: ${msg.versiculo.referencia} usado em ${dataMensagem.toISOString()}`);
          versiculosRecentes.push(msg.versiculo);
        }
      } catch (erroProcessamento) {
        logger.error(`Erro ao processar mensagem do histórico: ${erroProcessamento.message}`);
      }
    }
    
    logger.info(`Total de ${versiculosRecentes.length} versículos recentes encontrados`);
    
    // Listar todos os versículos encontrados para debug
    if (versiculosRecentes.length > 0) {
      const referencias = versiculosRecentes.map(v => v.referencia).join(', ');
      logger.info(`Versículos a serem evitados: ${referencias}`);
    } else {
      logger.info('Nenhum versículo recente a evitar');
    }
    
    return versiculosRecentes;
  } catch (erro) {
    logger.error(`Erro ao obter versículos recentes: ${erro.message}`);
    return [];
  }
}

// Verificar se um versículo foi usado recentemente
function versiculoFoiUsadoRecentemente(referencia, dias = 30) {
  try {
    if (!referencia) {
      logger.warn('Tentativa de verificar referência nula ou vazia');
      return false;
    }
    
    const versiculosRecentes = obterVersiculosRecentes(dias);
    
    // Normalizar a referência para comparação (remover espaços e converter para minúsculas)
    const referenciaFormatada = referencia.replace(/\s+/g, '').toLowerCase();
    
    // Verificar se a referência está na lista de versículos recentes
    const encontrado = versiculosRecentes.some(versiculo => {
      if (!versiculo || !versiculo.referencia) return false;
      
      const versiculoFormatado = versiculo.referencia.replace(/\s+/g, '').toLowerCase();
      const isMatch = versiculoFormatado === referenciaFormatada;
      
      if (isMatch) {
        logger.info(`Versículo ${referencia} já foi usado recentemente`);
      }
      
      return isMatch;
    });
    
    return encontrado;
  } catch (erro) {
    logger.error(`Erro ao verificar versículo: ${erro.message}`);
    return false;
  }
}

// Obter o último devocional enviado
async function obterUltimoDevocionalEnviado() {
  try {
    // Tentar obter do histórico geral primeiro
    const historico = historicoManager.carregarHistorico();
    
    if (historico && historico.mensagens && historico.mensagens.length > 0) {
      // Ordenar mensagens por data (mais recente primeiro)
      const mensagensOrdenadas = [...historico.mensagens].sort((a, b) => {
        const dataA = a.timestamp ? new Date(a.timestamp) : new Date(0);
        const dataB = b.timestamp ? new Date(b.timestamp) : new Date(0);
        return dataB - dataA;
      });
      
      // Verificar se o último devocional foi enviado hoje
      const hoje = new Date();
      const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      
      // Encontrar o último devocional
      for (const msg of mensagensOrdenadas) {
        if (msg.devocional) {
          // Extrair a data do timestamp
          const dataMensagem = new Date(msg.timestamp || msg.data);
          const dataMensagemStr = `${dataMensagem.getFullYear()}-${String(dataMensagem.getMonth() + 1).padStart(2, '0')}-${String(dataMensagem.getDate()).padStart(2, '0')}`;
          
          // Se o devocional for de hoje, retorná-lo
          if (dataMensagemStr === dataHoje) {
            logger.info(`Devocional de hoje encontrado no histórico geral (${dataMensagemStr})`);
            return msg.devocional;
          }
        }
      }
      
      // Se não encontrar um devocional de hoje, retorna o mais recente
      const ultimoDevocional = mensagensOrdenadas.find(msg => msg.devocional);
      if (ultimoDevocional) {
        logger.info('Retornando devocional mais recente disponível do histórico geral');
        return ultimoDevocional.devocional;
      }
    }
    
    // Se não encontrou no histórico geral, buscar nas conversas individuais
    logger.info('Buscando devocional nas conversas individuais...');
    
    const CONVERSAS_DIR = process.env.CONVERSAS_DIR || './Conversas';
    if (!fs.existsSync(CONVERSAS_DIR)) {
      logger.warn(`Diretório de conversas não encontrado: ${CONVERSAS_DIR}`);
      return null;
    }
    
    // Ler arquivos de conversa
    const arquivos = fs.readdirSync(CONVERSAS_DIR);
    const arquivosJson = arquivos.filter(arquivo => arquivo.endsWith('.json'));
    
    let devocionalMaisRecente = null;
    let dataMaisRecente = new Date(0); // Data antiga
    
    // Buscar em todas as conversas
    for (const arquivo of arquivosJson) {
      try {
        const conteudo = fs.readFileSync(path.join(CONVERSAS_DIR, arquivo), 'utf8');
        const conversa = JSON.parse(conteudo);
        
        if (conversa.ultimoDevocional) {
          const dataDevocional = new Date(conversa.ultimoDevocional.data);
          
          // Verificar se é mais recente que o último encontrado
          if (dataDevocional > dataMaisRecente) {
            devocionalMaisRecente = conversa.ultimoDevocional.conteudo;
            dataMaisRecente = dataDevocional;
          }
        }
      } catch (erroLeitura) {
        logger.error(`Erro ao ler arquivo de conversa ${arquivo}: ${erroLeitura.message}`);
      }
    }
    
    if (devocionalMaisRecente) {
      logger.info(`Devocional encontrado nas conversas individuais (data: ${dataMaisRecente.toISOString()})`);
      return devocionalMaisRecente;
    }
    
    logger.warn('Nenhum devocional encontrado no histórico ou nas conversas');
    return null;
  } catch (erro) {
    logger.error(`Erro ao obter último devocional: ${erro.message}`);
    return null;
  }
}

module.exports = {
  registrarEnvio,
  obterVersiculosRecentes,
  versiculoFoiUsadoRecentemente,
  obterUltimoDevocionalEnviado,
  extrairVersiculo
};
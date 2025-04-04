// Módulo para gerenciamento do histórico de mensagens enviadas (Refatorado e corrigido)

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
    
    // Log informativo
    logger.info(`Extraindo versículo de devocional com ${devocional.length} caracteres`);
    
    // Regex simplificada que funciona para a maioria dos formatos
    // Captura qualquer texto entre aspas seguido por texto entre parênteses
    const regexVersiculo = /"([^"]+)".*?\(([^)]+)\)/;
    const match = devocional.match(regexVersiculo);
    
    if (match && match.length >= 3) {
      const texto = match[1].trim();
      const referencia = match[2].trim();
      
      logger.info(`Versículo extraído com sucesso: "${texto}" (${referencia})`);
      return {
        texto: texto,
        referencia: referencia
      };
    }
    
    // Se falhar, tente uma regex ainda mais simples que apenas busca a referência bíblica
    const referenciaRegex = /\(([A-Za-záàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ]+\s+\d+:\d+(?:-\d+)?)\)/i;
    const refMatch = devocional.match(referenciaRegex);
    
    if (refMatch && refMatch.length >= 2) {
      const referencia = refMatch[1].trim();
      logger.info(`Apenas referência bíblica extraída: ${referencia}`);
      return {
        texto: "Extraído apenas referência",
        referencia: referencia
      };
    }
    
    // Log de falha
    logger.warn(`Não foi possível extrair versículo do devocional (mostrando primeiros 100 caracteres): ${devocional.substring(0, 100)}...`);
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
    const novaEntrada = {
      data: dados.data,
      devocional: dados.devocional,
      versiculo: versiculo,
      totalContatos: dados.totalContatos,
      enviosComSucesso: dados.enviosComSucesso,
      timestamp: new Date().toISOString()
    };
    
    // Adicionar ao histórico e log detalhado
    historico.mensagens.push(novaEntrada);
    logger.info(`Adicionada nova entrada ao histórico: ${novaEntrada.timestamp}`);
    logger.info(`Histórico agora tem ${historico.mensagens.length} entradas`);
    
    // Limpar mensagens antigas antes de salvar
    limparHistoricoAntigo(historico);
    
    // Salvar o histórico atualizado
    const salvou = historicoManager.salvarHistorico(historico);
    
    if (salvou) {
      logger.info('Envio registrado no histórico com sucesso');
    } else {
      logger.error('Erro ao salvar o histórico após registrar envio');
    }
    
    return salvou;
  } catch (erro) {
    logger.error(`Erro ao registrar envio no histórico: ${erro.message}`);
    logger.error(erro.stack); // Log detalhado do erro incluindo stack trace
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
        if (!msg.timestamp || !msg.versiculo) continue;
        
        // Usar o timestamp para determinar se é recente
        const dataMensagem = new Date(msg.timestamp);
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
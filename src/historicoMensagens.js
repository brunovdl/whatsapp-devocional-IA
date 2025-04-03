// Módulo para gerenciamento do histórico de mensagens enviadas

const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./utils');

// Configurações do histórico
const HISTORICO_DIR = process.env.HISTORICO_DIR || './Histórico';
const HISTORICO_FILE = process.env.HISTORICO_FILE || './Histórico/historico.json';
const MAX_HISTORICO_DIAS = parseInt(process.env.MAX_HISTORICO_DIAS || '90', 10);

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
        const historico = JSON.parse(conteudo);
        // Garantir que o objeto tem a estrutura esperada
        if (!historico.mensagens) {
          historico.mensagens = [];
        }
        return historico;
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
    
    fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historico, null, 2));
    logger.info('Histórico salvo com sucesso');
  } catch (erro) {
    logger.error(`Erro ao salvar histórico: ${erro.message}`);
  }
}

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
      salvarHistorico(historico);
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
    // Procurar o padrão de versículo na mensagem
    const regexVersiculo = /Versículo:\s*["'](.+?)["']\s*\((.+?)\)/i;
    const match = devocional.match(regexVersiculo);
    
    if (match && match.length >= 3) {
      return {
        texto: match[1].trim(),
        referencia: match[2].trim()
      };
    }
    
    return null;
  } catch (erro) {
    logger.error(`Erro ao extrair versículo: ${erro.message}`);
    return null;
  }
}

// Registrar um envio no histórico
function registrarEnvio(dados) {
  try {
    const historico = carregarHistorico();
    const versiculo = extrairVersiculo(dados.devocional);
    
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
    
    logger.info('Envio registrado no histórico com sucesso');
  } catch (erro) {
    logger.error(`Erro ao registrar envio no histórico: ${erro.message}`);
  }
}

// Obter versículos usados recentemente (para evitar repetições)
function obterVersiculosRecentes(dias = 30) {
  try {
    const historico = carregarHistorico();
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    
    const versiculosRecentes = historico.mensagens
      .filter(msg => {
        const dataMensagem = new Date(msg.data);
        return dataMensagem >= dataLimite && msg.versiculo;
      })
      .map(msg => msg.versiculo);
    
    return versiculosRecentes;
  } catch (erro) {
    logger.error(`Erro ao obter versículos recentes: ${erro.message}`);
    return [];
  }
}

// Obter o último devocional enviado
async function obterUltimoDevocionalEnviado() {
  try {
    // Tentar obter do histórico geral primeiro
    const historico = carregarHistorico();
    
    if (historico && historico.mensagens && historico.mensagens.length > 0) {
      // Ordenar mensagens por data (mais recente primeiro)
      const mensagensOrdenadas = [...historico.mensagens].sort((a, b) => 
        new Date(b.data) - new Date(a.data)
      );
      
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

// Verificar se um versículo foi usado recentemente
function versiculoFoiUsadoRecentemente(referencia, dias = 30) {
  try {
    const versiculosRecentes = obterVersiculosRecentes(dias);
    
    // Normalizar a referência para comparação (remover espaços e converter para minúsculas)
    const referenciaFormatada = referencia.replace(/\s+/g, '').toLowerCase();
    
    return versiculosRecentes.some(versiculo => {
      const versiculoFormatado = versiculo.referencia.replace(/\s+/g, '').toLowerCase();
      return versiculoFormatado === referenciaFormatada;
    });
  } catch (erro) {
    logger.error(`Erro ao verificar versículo: ${erro.message}`);
    return false;
  }
}

module.exports = {
  registrarEnvio,
  obterVersiculosRecentes,
  versiculoFoiUsadoRecentemente,
  obterUltimoDevocionalEnviado
};
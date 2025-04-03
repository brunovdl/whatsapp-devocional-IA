// Módulo gerador de devocionais com IA (Google Gemini)

const { GoogleGenerativeAI } = require('@google/generative-ai');
const leitorDocumentos = require('./leitorDocumentos');
const historicoMensagens = require('./historicoMensagens');
const { logger } = require('./utils');

// Configuração da API do Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Inicializar o cliente Gemini
let genAI;
let geminiModel;

// Função para inicializar a API do Gemini
function inicializarGeminiAPI() {
  try {
    if (!GEMINI_API_KEY) {
      logger.error('Chave da API do Gemini não configurada no arquivo .env');
      return false;
    }
    
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Corrigindo para usar o nome do modelo correto
    // Verificar qual modelo está disponível (gemini-pro ou gemini-1.5-pro)
    geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    logger.info('API do Google Gemini inicializada com sucesso');
    return true;
  } catch (erro) {
    logger.error(`Erro ao inicializar API do Gemini: ${erro.message}`);
    return false;
  }
}

// Tentar inicializar a API
inicializarGeminiAPI();

// Gerar um prompt para o Gemini
async function gerarPrompt(dataAtual) {
  try {
    // Obter conteúdo da base de conhecimento
    const baseConhecimento = await leitorDocumentos.obterConteudoBase();
    
    // Obter versículos recentes (para evitar repetições)
    const versiculosRecentes = historicoMensagens.obterVersiculosRecentes(10); // Aumentei para 10 dias
    const versiculosRecentesTexto = versiculosRecentes
      .map(v => {
        if (!v || !v.referencia || !v.texto) return '';
        return `${v.referencia}: "${v.texto}"`;
      })
      .filter(v => v) // Remove entradas vazias
      .join('\n');
    
    // Adicionar log para debug
    logger.info(`Versículos a serem evitados: ${versiculosRecentesTexto || "Nenhum"}`);
    
    // Construir o prompt
    const prompt = `
      Você é um bot de WhatsApp com inteligência artificial projetado para enviar um devocional diário todas as manhãs.
      
      Seu objetivo é criar uma mensagem devocional que contenha:
      1. A data atual (${dataAtual})
      2. Um versículo bíblico relevante
      3. Um texto explicativo sobre o versículo (3-5 frases)
      4. Uma sugestão prática para o dia (1-2 frases)
      
      MUITO IMPORTANTE: Você deve gerar um devocional com um versículo diferente a cada dia. Nunca repita versículos que já foram usados recentemente.
      
      Baseie-se no seguinte conteúdo para selecionar o versículo e elaborar a reflexão:
      
      ${baseConhecimento.substring(0, 15000)} 
      
      Evite usar ABSOLUTAMENTE os seguintes versículos que foram utilizados recentemente:
      ${versiculosRecentesTexto || "Nenhum versículo recente a evitar."}
      
      O tom deve ser amigável, acolhedor e espiritual.
      
      Exemplo do formato esperado:
      
      "${dataAtual}
      
      Versículo: \"Tudo o que fizerem, façam de todo o coração, como para o Senhor.\" (Colossenses 3:23)
      
      Reflexão: Este versículo nos lembra que nossas ações diárias, por menores que sejam, ganham significado quando as dedicamos a Deus. Trabalhar, ajudar alguém ou até descansar pode ser uma forma de honrá-Lo se fizermos com amor e propósito. Que tal começar o dia com essa intenção no coração?
      
      Prática: Hoje, escolha uma tarefa simples e a realize com dedicação, pensando em como ela pode refletir seu cuidado com os outros e com Deus.\"
      
      Gere o devocional seguindo exatamente esse formato. Apenas a saída final, sem comentários adicionais.
    `;
    
    return prompt.trim();
  } catch (erro) {
    logger.error(`Erro ao gerar prompt: ${erro.message}`);
    throw erro;
  }
}

// Modifique a função gerarDevocional para incluir a validação
async function gerarDevocional(dataAtual) {
  try {
    // Verificar se a API foi inicializada corretamente
    if (!geminiModel) {
      logger.warn('API do Gemini não inicializada. Tentando inicializar novamente...');
      
      // Tentar inicializar novamente
      const inicializou = inicializarGeminiAPI();
      
      if (!inicializou || !geminiModel) {
        throw new Error('Falha ao inicializar API do Gemini. Verifique a chave de API.');
      }
    }
    
    // Contador de tentativas para evitar loop infinito
    let tentativas = 0;
    const maxTentativas = 3;
    let devocionalValido = false;
    let devocional = '';
    
    while (!devocionalValido && tentativas < maxTentativas) {
      tentativas++;
      logger.info(`Gerando devocional - tentativa ${tentativas}/${maxTentativas}`);
      
      // Gerar o prompt com os versículos a serem evitados
      const prompt = await gerarPrompt(dataAtual);
      
      try {
        const result = await geminiModel.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7 + (tentativas * 0.1), // Aumentar a temperatura a cada tentativa
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        });
        
        const response = result.response;
        devocional = response.text().trim();
        
        // Verificar se o devocional foi gerado corretamente
        if (!devocional || devocional.length < 50) {
          logger.warn('Devocional gerado muito curto ou vazio. Tentando novamente.');
          continue;
        }
        
        // Validar se o versículo não foi usado recentemente
        devocionalValido = await validarDevocionalGerado(devocional);
        
        if (devocionalValido) {
          logger.info('Devocional válido gerado com sucesso');
          return devocional;
        } else {
          logger.warn('Devocional gerado usa versículo repetido. Tentando novamente.');
        }
      } catch (erroGemini) {
        logger.warn(`Erro com o modelo na tentativa ${tentativas}: ${erroGemini.message}`);
        
        if (tentativas >= maxTentativas) {
          logger.error('Número máximo de tentativas atingido. Usando fallback.');
          return gerarDevocionalFallback(dataAtual);
        }
      }
    }
    
    // Se chegou aqui sem um devocional válido, usar fallback
    if (!devocionalValido) {
      logger.warn('Não foi possível gerar um devocional com versículo único. Usando fallback.');
      return gerarDevocionalFallback(dataAtual);
    }
    
    return devocional;
  } catch (erro) {
    logger.error(`Erro ao gerar devocional: ${erro.message}`);
    return gerarDevocionalFallback(dataAtual);
  }
}

// Gerar o devocional utilizando o Gemini
async function gerarDevocional(dataAtual) {
  try {
    // Verificar se a API foi inicializada corretamente
    if (!geminiModel) {
      logger.warn('API do Gemini não inicializada. Tentando inicializar novamente...');
      
      // Tentar inicializar novamente
      const inicializou = inicializarGeminiAPI();
      
      if (!inicializou || !geminiModel) {
        throw new Error('Falha ao inicializar API do Gemini. Verifique a chave de API.');
      }
    }
    
    logger.info('Gerando prompt para o Gemini...');
    const prompt = await gerarPrompt(dataAtual);
    
    logger.info('Solicitando geração de devocional ao Gemini...');
    
    try {
      const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      });
      
      const response = result.response;
      const devocional = response.text().trim();
      
      // Verificar se o devocional foi gerado corretamente
      if (!devocional || devocional.length < 50) {
        logger.warn('Devocional gerado muito curto ou vazio. Usando fallback.');
        return gerarDevocionalFallback(dataAtual);
      }
      
      logger.info('Devocional gerado com sucesso');
      return devocional;
    } catch (erroGemini) {
      // Tentar usar outro modelo se o modelo atual falhar
      logger.warn(`Erro com o modelo atual. Detalhe: ${erroGemini.message}`);
      
      try {
        // Tentar com modelo alternativo
        logger.info('Tentando modelo alternativo gemini-pro...');
        const modeloAlternativo = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const resultadoAlternativo = await modeloAlternativo.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        });
        
        const respostaAlternativa = resultadoAlternativo.response;
        const devocionalAlternativo = respostaAlternativa.text().trim();
        
        logger.info('Devocional gerado com sucesso usando modelo alternativo');
        return devocionalAlternativo;
      } catch (erroModeloAlternativo) {
        logger.error(`Erro também no modelo alternativo: ${erroModeloAlternativo.message}`);
        throw new Error(`Falha em todos os modelos Gemini disponíveis`);
      }
    }
  } catch (erro) {
    logger.error(`Erro ao gerar devocional: ${erro.message}`);
    
    // Retornar um devocional de fallback em caso de erro
    return gerarDevocionalFallback(dataAtual);
  }
}

// Gerar um devocional de fallback em caso de erro na API
function gerarDevocionalFallback(dataAtual) {
  logger.info('Gerando devocional de fallback...');
  
  return `${dataAtual}

*✝️ Versículo:* "Não temas, porque eu sou contigo; não te assombres, porque eu sou teu Deus; eu te fortaleço, e te ajudo, e te sustento com a destra da minha justiça." (Isaías 41:10)

*💭 Reflexão:* Mesmo quando enfrentamos dificuldades ou desafios inesperados, Deus está ao nosso lado, pronto para nos dar força e sustento. Este versículo nos lembra que não precisamos temer, pois temos a presença constante do Senhor em nossas vidas, guiando nossos passos e iluminando nosso caminho.

*🧗🏻 Prática:* Hoje, ao enfrentar qualquer situação desafiadora, faça uma pausa, respire e relembre esta promessa de sustento divino antes de prosseguir.`;
}

module.exports = {
  gerarDevocional
};
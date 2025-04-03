// Módulo para leitura da lista de contatos de arquivos Excel ou CSV

const fs = require('fs-extra');
const path = require('path');
const xlsx = require('xlsx');
const csvParser = require('csv-parser');
const { adicionarNovoContatoNaPlanilha } = require('./adicionarContato');
const { logger } = require('./utils');

// Diretório de contatos
const CONTATOS_DIR = process.env.CONTATOS_DIR || './Contatos';

// Obter a lista de arquivos de contatos disponíveis
function obterArquivosContatos() {
  try {
    const arquivos = fs.readdirSync(CONTATOS_DIR);
    return arquivos.filter(arquivo => {
      const extensao = path.extname(arquivo).toLowerCase();
      return extensao === '.xlsx' || extensao === '.csv';
    });
  } catch (erro) {
    logger.error(`Erro ao ler diretório de contatos: ${erro.message}`);
    return [];
  }
}

// Ler contatos de um arquivo Excel
async function lerContatosExcel(caminhoArquivo) {
  try {
    logger.info(`Lendo arquivo Excel: ${caminhoArquivo}`);
    
    // Opções adicionais para melhorar a leitura
    const workbook = xlsx.readFile(caminhoArquivo, {
      cellDates: true,
      cellNF: true,
      cellText: true
    });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      logger.error('Arquivo Excel sem planilhas');
      return [];
    }
    
    // Verificar todas as planilhas para encontrar contatos
    let todosContatos = [];
    
    for (const sheetName of workbook.SheetNames) {
      logger.info(`Processando planilha: ${sheetName}`);
      
      const worksheet = workbook.Sheets[sheetName];
      
      // Verificar se a planilha tem dados
      if (!worksheet['!ref']) {
        logger.warn(`Planilha ${sheetName} vazia, pulando...`);
        continue;
      }
      
      // Tentar ler os dados da planilha
      try {
        const dados = xlsx.utils.sheet_to_json(worksheet, {
          defval: '',  // Valor padrão para células vazias
          raw: false   // Não converter tipos automaticamente
        });
        
        logger.info(`Encontrados ${dados.length} registros na planilha ${sheetName}`);
        
        if (dados.length > 0) {
          const contatos = normalizarContatos(dados);
          logger.info(`${contatos.length} contatos válidos na planilha ${sheetName}`);
          todosContatos = todosContatos.concat(contatos);
        }
      } catch (erroLeitura) {
        logger.error(`Erro ao processar planilha ${sheetName}: ${erroLeitura.message}`);
      }
    }
    
    return todosContatos;
  } catch (erro) {
    logger.error(`Erro ao ler arquivo Excel: ${erro.message}`);
    logger.error(erro.stack);
    return [];
  }
}

// Ler contatos de um arquivo CSV
async function lerContatosCsv(caminhoArquivo) {
  return new Promise((resolve, reject) => {
    const contatos = [];
    
    fs.createReadStream(caminhoArquivo)
      .pipe(csvParser())
      .on('data', (row) => {
        contatos.push(row);
      })
      .on('end', () => {
        resolve(normalizarContatos(contatos));
      })
      .on('error', (erro) => {
        logger.error(`Erro ao ler arquivo CSV: ${erro.message}`);
        reject(erro);
      });
  });
}

// Normalizar os dados dos contatos para um formato padrão
function normalizarContatos(dados) {
  if (!dados || !Array.isArray(dados) || dados.length === 0) {
    logger.warn('Nenhum dado de contato válido encontrado para normalizar');
    return [];
  }
  
  // Registrar os campos encontrados no primeiro registro para debug
  if (dados.length > 0) {
    logger.info(`Campos encontrados na planilha: ${Object.keys(dados[0]).join(', ')}`);
  }
  
  return dados.map(contato => {
    // Tentar encontrar os campos de nome e telefone, independente da capitalização
    const entradas = Object.entries(contato);
    let nome = '';
    let telefone = '';
    let ativo = true;
    
    // Debug para cada contato
    logger.info(`Processando contato: ${JSON.stringify(contato)}`);
    
    for (const [chave, valor] of entradas) {
      if (!chave) continue;
      
      const chaveLower = String(chave).toLowerCase();
      
      if (chaveLower.includes('nome')) {
        nome = valor;
        logger.info(`Nome encontrado: ${nome}`);
      } else if (
        chaveLower.includes('telefone') || 
        chaveLower.includes('celular') || 
        chaveLower.includes('whatsapp') || 
        chaveLower.includes('fone') ||
        chaveLower.includes('phone') ||
        chaveLower.includes('numero')
      ) {
        telefone = valor;
        logger.info(`Telefone encontrado (original): ${telefone}`);
      } else if (
        chaveLower.includes('ativo') || 
        chaveLower.includes('status') || 
        chaveLower.includes('habilitado')
      ) {
        // Considerar o contato ativo se o campo for 'sim', 'true', 1, etc.
        if (typeof valor === 'string') {
          const valorLower = String(valor).toLowerCase();
          ativo = valorLower === 'sim' || valorLower === 'true' || valorLower === 's' || valorLower === 'y' || valorLower === 'yes';
        } else {
          ativo = Boolean(valor);
        }
      }
    }
    
    // Se não encontrar telefone, tentar encontrar algum campo que pareça ser um número de telefone
    if (!telefone) {
      for (const [chave, valor] of entradas) {
        // Verificar se o valor se parece com um número de telefone (apenas dígitos e com pelo menos 8 caracteres)
        if (valor && typeof valor === 'string' && valor.replace(/\D/g, '').length >= 8) {
          telefone = valor;
          logger.info(`Possível telefone encontrado no campo ${chave}: ${telefone}`);
          break;
        }
      }
    }
    
    // Garantir que telefone seja uma string antes de aplicar replace
    let telefoneFormatado = '';
    if (telefone !== undefined && telefone !== null) {
      // Normalizar o telefone (remover caracteres não numéricos)
      telefoneFormatado = String(telefone).replace(/\D/g, '');
      
      // Adicionar código do país (55) se não estiver presente e for um número brasileiro
      if (telefoneFormatado.length >= 10 && telefoneFormatado.length <= 11 && !telefoneFormatado.startsWith('55')) {
        telefoneFormatado = `55${telefoneFormatado}`;
        logger.info(`Adicionado código do país: ${telefoneFormatado}`);
      }
    }
    
    logger.info(`Telefone formatado: ${telefoneFormatado}`);
    
    return {
      nome: nome || 'Sem nome',
      telefone: telefoneFormatado,
      ativo: ativo
    };
  })
  // Filtrar contatos sem telefone ou inativos
  .filter(contato => {
    // Verificar se o telefone é válido (pelo menos 10 dígitos)
    const telefoneValido = contato.telefone && contato.telefone.length >= 10;
    
    if (!telefoneValido) {
      logger.warn(`Contato "${contato.nome}" ignorado: número de telefone inválido (${contato.telefone})`);
    } else if (!contato.ativo) {
      logger.info(`Contato "${contato.nome}" ignorado: está marcado como inativo`);
    } else {
      logger.info(`Contato válido: ${contato.nome} (${contato.telefone})`);
    }
    
    return telefoneValido && contato.ativo;
  });
}

// Função principal para obter todos os contatos de todos os arquivos
async function obterContatos() {
  try {
    const arquivos = obterArquivosContatos();
    
    if (arquivos.length === 0) {
      logger.warn('Nenhum arquivo de contatos encontrado no diretório');
      return [];
    }
    
    let todosContatos = [];
    
    for (const arquivo of arquivos) {
      const caminhoArquivo = path.join(CONTATOS_DIR, arquivo);
      const extensao = path.extname(arquivo).toLowerCase();
      
      logger.info(`Lendo contatos do arquivo: ${arquivo}`);
      
      let contatos = [];
      if (extensao === '.xlsx') {
        contatos = await lerContatosExcel(caminhoArquivo);
      } else if (extensao === '.csv') {
        contatos = await lerContatosCsv(caminhoArquivo);
      }
      
      logger.info(`${contatos.length} contatos válidos encontrados em ${arquivo}`);
      todosContatos = todosContatos.concat(contatos);
    }
    
    // Remover duplicatas baseadas no número de telefone
    const contatosUnicos = {};
    todosContatos.forEach(contato => {
      contatosUnicos[contato.telefone] = contato;
    });
    
    const resultado = Object.values(contatosUnicos);
    logger.info(`Total de ${resultado.length} contatos únicos encontrados`);
    
    return resultado;
  } catch (erro) {
    logger.error(`Erro ao obter contatos: ${erro.message}`);
    return [];
  }
}

module.exports = {
  obterContatos,
  adicionarNovoContatoNaPlanilha
};
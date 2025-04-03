// Módulo para adicionar novos contatos à planilha

const fs = require('fs-extra');
const path = require('path');
const xlsx = require('xlsx');
const csvParser = require('csv-parser');
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

// Adicionar novo contato à planilha
async function adicionarNovoContatoNaPlanilha(telefone, nomeContato = "Novo Contato") {
  try {
    const arquivos = obterArquivosContatos();
    
    if (arquivos.length === 0) {
      logger.warn('Nenhum arquivo de contatos encontrado. Criando novo arquivo.');
      return criarNovoArquivoContatos(telefone, nomeContato);
    }
    
    // Usar o primeiro arquivo encontrado (normalmente contatos_exemplo.xlsx)
    const arquivoContatos = path.join(CONTATOS_DIR, arquivos[0]);
    const extensao = path.extname(arquivoContatos).toLowerCase();
    
    // Verificar se é Excel ou CSV
    if (extensao === '.xlsx') {
      return adicionarContatoExcel(arquivoContatos, telefone, nomeContato);
    } else if (extensao === '.csv') {
      return adicionarContatoCsv(arquivoContatos, telefone, nomeContato);
    } else {
      logger.error(`Formato de arquivo não suportado: ${extensao}`);
      return false;
    }
  } catch (erro) {
    logger.error(`Erro ao adicionar novo contato ${telefone}: ${erro.message}`);
    return false;
  }
}

// Adicionar contato a um arquivo Excel
async function adicionarContatoExcel(caminhoArquivo, telefone, nomeContato) {
  try {
    logger.info(`Adicionando contato ${telefone} ao arquivo Excel: ${caminhoArquivo}`);
    
    // Formatar o telefone conforme o padrão
    const telefoneFormatado = formatarTelefone(telefone);
    
    // Ler o arquivo Excel existente
    const workbook = xlsx.readFile(caminhoArquivo, {
      cellDates: true,
      cellNF: true,
      cellText: true
    });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      logger.error('Arquivo Excel sem planilhas');
      return false;
    }
    
    // Usar a primeira planilha
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Converter para JSON para manipulação
    const dados = xlsx.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false
    });
    
    // Verificar se o contato já existe
    const contatoExistente = dados.find(contato => {
      // Normalizar números de telefone para comparação
      const telefoneExistente = String(contato.Telefone || '').replace(/\D/g, '');
      const telefoneNovo = telefoneFormatado.replace(/\D/g, '');
      
      return telefoneExistente === telefoneNovo || 
             telefoneExistente === telefoneNovo.replace(/^55/, '') || 
             `55${telefoneExistente}` === telefoneNovo;
    });
    
    if (contatoExistente) {
      logger.info(`Contato ${telefone} já existe na planilha.`);
      return false;
    }
    
    // Adicionar o novo contato
    const novoContato = {
      Nome: nomeContato,
      Telefone: telefoneFormatado,
      Ativo: 'Sim',
      Observacoes: `Adicionado automaticamente em ${new Date().toLocaleDateString()}`
    };
    
    dados.push(novoContato);
    
    // Converter de volta para planilha
    const novaWorksheet = xlsx.utils.json_to_sheet(dados);
    workbook.Sheets[sheetName] = novaWorksheet;
    
    // Salvar o arquivo atualizado
    xlsx.writeFile(workbook, caminhoArquivo);
    
    logger.info(`Novo contato ${telefoneFormatado} (${nomeContato}) adicionado à planilha com sucesso.`);
    return true;
  } catch (erro) {
    logger.error(`Erro ao adicionar contato no Excel: ${erro.message}`);
    return false;
  }
}

// Adicionar contato a um arquivo CSV
async function adicionarContatoCsv(caminhoArquivo, telefone, nomeContato) {
  try {
    logger.info(`Adicionando contato ${telefone} ao arquivo CSV: ${caminhoArquivo}`);
    
    // Formatar o telefone conforme o padrão
    const telefoneFormatado = formatarTelefone(telefone);
    
    // Ler o arquivo CSV existente
    const contatos = await new Promise((resolve, reject) => {
      const linhas = [];
      
      fs.createReadStream(caminhoArquivo)
        .pipe(csvParser())
        .on('data', (row) => {
          linhas.push(row);
        })
        .on('end', () => {
          resolve(linhas);
        })
        .on('error', (erro) => {
          reject(erro);
        });
    });
    
    // Verificar se o contato já existe
    const contatoExistente = contatos.find(contato => {
      // Normalizar números de telefone para comparação
      const telefoneExistente = String(contato.Telefone || '').replace(/\D/g, '');
      const telefoneNovo = telefoneFormatado.replace(/\D/g, '');
      
      return telefoneExistente === telefoneNovo || 
             telefoneExistente === telefoneNovo.replace(/^55/, '') || 
             `55${telefoneExistente}` === telefoneNovo;
    });
    
    if (contatoExistente) {
      logger.info(`Contato ${telefone} já existe no arquivo CSV.`);
      return false;
    }
    
    // Adicionar o novo contato
    const novoContato = {
      Nome: nomeContato,
      Telefone: telefoneFormatado,
      Ativo: 'Sim',
      Observacoes: `Adicionado automaticamente em ${new Date().toLocaleDateString()}`
    };
    
    contatos.push(novoContato);
    
    // Obter os cabeçalhos
    const cabecalhos = Object.keys(contatos[0]);
    
    // Criar o conteúdo CSV
    const csvContent = [
      cabecalhos.join(','),
      ...contatos.map(contato => 
        cabecalhos.map(cabecalho => 
          `"${String(contato[cabecalho] || '').replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n');
    
    // Salvar o arquivo atualizado
    fs.writeFileSync(caminhoArquivo, csvContent, 'utf8');
    
    logger.info(`Novo contato ${telefoneFormatado} (${nomeContato}) adicionado ao CSV com sucesso.`);
    return true;
  } catch (erro) {
    logger.error(`Erro ao adicionar contato no CSV: ${erro.message}`);
    return false;
  }
}

// Criar novo arquivo de contatos se não existir nenhum
function criarNovoArquivoContatos(telefone, nomeContato) {
  try {
    logger.info('Criando novo arquivo de contatos...');
    
    // Garantir que o diretório existe
    if (!fs.existsSync(CONTATOS_DIR)) {
      fs.mkdirSync(CONTATOS_DIR, { recursive: true });
    }
    
    // Formatar o telefone conforme o padrão
    const telefoneFormatado = formatarTelefone(telefone);
    
    // Criar dados iniciais
    const contatos = [
      {
        Nome: nomeContato,
        Telefone: telefoneFormatado,
        Ativo: 'Sim',
        Observacoes: `Adicionado automaticamente em ${new Date().toLocaleDateString()}`
      }
    ];
    
    // Criar arquivo Excel
    const caminhoArquivo = path.join(CONTATOS_DIR, 'contatos.xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(contatos);
    
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Contatos');
    xlsx.writeFile(workbook, caminhoArquivo);
    
    logger.info(`Novo arquivo de contatos criado com o contato ${telefoneFormatado}`);
    return true;
  } catch (erro) {
    logger.error(`Erro ao criar novo arquivo de contatos: ${erro.message}`);
    return false;
  }
}

// Função auxiliar para formatar número de telefone
function formatarTelefone(telefone) {
  // Remover caracteres não numéricos
  let telefoneFormatado = String(telefone).replace(/\D/g, '');
  
  // Adicionar código do país (55) se não estiver presente e for um número brasileiro
  if (telefoneFormatado.length >= 10 && telefoneFormatado.length <= 11 && !telefoneFormatado.startsWith('55')) {
    telefoneFormatado = `55${telefoneFormatado}`;
  }
  
  return telefoneFormatado;
}

module.exports = {
  adicionarNovoContatoNaPlanilha
};
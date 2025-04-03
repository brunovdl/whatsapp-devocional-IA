## Funcionalidade de Diálogo Interativo

Esta versão do sistema inclui suporte para diálogo individualizado com os usuários:

### Como funciona:

1. **Envio do Devocional**: O sistema envia automaticamente o devocional diário para todos os contatos cadastrados no horário programado.

2. **Recebimento de Mensagens**: Quando um usuário responde ou faz uma pergunta sobre o devocional, o sistema:
   - Analisa se a mensagem requer uma resposta elaborada
   - Usa a IA para gerar uma resposta personalizada considerando:
     - O devocional enviado recentemente
     - O histórico de conversa com aquele usuário específico
     - A base de conhecimento religiosa

3. **Contexto Individualizado**: O sistema mantém históricos de conversa separados para cada usuário, permitindo:
   - Respostas personalizadas
   - Referências a mensagens anteriores da mesma conversa
   - Continuidade no diálogo

### Configurações:

No arquivo `.env` você pode ajustar:

- `RESPONDER_AUTOMATICAMENTE=true` - Ativar/desativar resposta automática
- `MAX_HISTORICO_CONVERSAS=10` - Número de mensagens armazenadas por conversa

### Limitações:

- O sistema foi projetado para responder a perguntas relacionadas ao devocional
- Mensagens curtas ou simples recebem respostas padrão mais breves
- A IA foi instruída a manter um tom amigável, acolhedor e espiritual# WhatsApp Devocional Diário com IA

Um bot de WhatsApp automatizado que envia mensagens devocionais diárias geradas por IA para uma lista de contatos pré-definida.

## Testes e Exemplos

O sistema inclui scripts de teste para verificar componentes individuais:

### Testar geração de devocionais:

```bash
node scripts/testar_devocional.js
```

Este script gera um devocional usando a API do Google Gemini e sua base de conhecimento, sem enviar mensagens para os contatos. O resultado é exibido no console e salvo no arquivo `scripts/devocional_gerado.txt`.

### Criar arquivo de contatos de exemplo:

```bash
node scripts/criar_exemplo_contatos.js
```

Este script cria um arquivo Excel com contatos de exemplo na pasta `Contatos/` que você pode usar como referência para o formato correto.

### Testar sistema de conversas com IA:

```bash
node scripts/testar_conversas.js
```

Este script simula uma conversa interativa entre um usuário e o bot, permitindo testar como o sistema responde a perguntas sobre o devocional enviado. Você pode digitar mensagens como se fosse um usuário e ver as respostas geradas pela IA. Características

- 🤖 Integração com o Google Gemini para geração de conteúdo devocional
- 📱 Envio automático de mensagens via WhatsApp
- 💬 **Diálogo individualizado com usuários através de IA generativa**
- 📊 Suporte para leitura de contatos de arquivos Excel e CSV
- 📚 Base de conhecimento personalizável com suporte para diversos formatos de arquivo
- 📅 Agendamento diário automático
- 📝 Registro de histórico para evitar repetição de versículos
- 🧩 Arquitetura modular para fácil manutenção e extensão

## Requisitos

- Node.js (v14 ou superior)
- Acesso à API do Google Gemini (chave de API)
- Um dispositivo ou servidor para executar o bot

## Estrutura do Projeto

```
📁 WhatsApp-Devocional-IA/
├── 📁 Base_de_conhecimento/     # Coloque aqui seus documentos de referência
├── 📁 Contatos/                 # Coloque aqui suas planilhas de contatos
├── 📁 Conversas/                # Armazena históricos de conversas individuais
├── 📁 Histórico/                # Histórico de mensagens enviadas
│   └── 📄 historico.json        # Registro automático dos envios
├── 📁 src/                      # Código fonte do sistema
│   ├── 📄 index.js              # Ponto de entrada da aplicação
│   ├── 📄 whatsapp.js           # Módulo de conexão com WhatsApp
│   ├── 📄 geradorDevocional.js  # Módulo gerador de devocionais com IA
│   ├── 📄 leitorDocumentos.js   # Módulo para processamento dos documentos base
│   ├── 📄 leitorContatos.js     # Módulo para leitura da lista de contatos
│   ├── 📄 historicoMensagens.js # Módulo para gerenciamento do histórico
│   ├── 📄 conversasHandler.js   # Módulo para diálogo individualizado com IA
│   └── 📄 utils.js              # Funções utilitárias
├── 📁 scripts/                  # Scripts de teste e utilitários
├── 📄 package.json              # Dependências do projeto
├── 📄 .env                      # Configurações do projeto
└── 📄 README.md                 # Esta documentação
```

## Configuração

1. Clone este repositório
2. Execute `npm install` para instalar as dependências
3. Copie o arquivo `.env.example` para `.env` e configure:
   - Chave de API do Google Gemini
   - Horário de envio das mensagens
   - Outras configurações conforme necessário
4. Adicione seus documentos de referência à pasta `Base_de_conhecimento`
5. Adicione sua lista de contatos à pasta `Contatos` (em formato Excel ou CSV)

### Formato da Planilha de Contatos

A planilha deve conter pelo menos as seguintes colunas:
- `Nome`: Nome do contato
- `Telefone`: Número de telefone com código do país (ex: 5511987654321)
- `Ativo`: Opcional, para indicar se o contato deve receber mensagens (Sim/Não)

## Uso

Para iniciar o bot:

```bash
npm start
```

Na primeira execução, será exibido um QR Code que deve ser escaneado com o WhatsApp do seu celular para autenticar a sessão.

##

## Base de Conhecimento

A pasta `Base_de_conhecimento` aceita os seguintes formatos de arquivo:
- PDF (.pdf)
- Texto simples (.txt)
- JSON (.json)
- Excel (.xlsx)
- CSV (.csv)

Estes documentos serão utilizados como referência para a IA gerar os devocionais diários.

## Personalização

Para personalizar o formato dos devocionais, edite o arquivo `src/geradorDevocional.js`.

## Manutenção

O sistema mantém um histórico de mensagens enviadas para evitar repetição de versículos. Este histórico é armazenado em `Histórico/historico.json`.

## Solução de Problemas

### Cliente do WhatsApp não conecta
- Verifique se não há outra sessão do WhatsApp Web ativa
- Apague a pasta `whatsapp-session` e reinicie o sistema
- Certifique-se de escanear o QR code quando solicitado

### Erros na geração do devocional
- Verifique se a chave de API do Google Gemini está correta no arquivo `.env`
- Certifique-se de usar o nome correto do modelo na API (gemini-1.5-pro ou gemini-pro)
- Verifique se há documentos válidos na pasta `Base_de_conhecimento`
- Execute o script de teste `scripts/testar_devocional.js` para verificar se a geração funciona

### Problemas com contatos
- Verifique se o arquivo de contatos está no formato correto (Excel ou CSV)
- Certifique-se de que os contatos tenham pelo menos uma coluna chamada "Nome" e outra "Telefone"
- Confirme que os números de telefone estão completos com código do país (ex: 5511987654321)
- Use o arquivo de exemplo `contatos_exemplo.xlsx` como referência
- Para diagnóstico, verifique os logs detalhados que mostram como os contatos estão sendo processados

### Erros no histórico de mensagens
- Se ocorrerem erros relacionados ao histórico, verifique se o arquivo `historico.json` existe e tem o formato correto
- Em caso de problemas persistentes, exclua o arquivo `Histórico/historico.json` e deixe o sistema recriá-lo automaticamente

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.
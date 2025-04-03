# Fluxo de Trabalho Git para o WhatsApp Devocional

Este documento descreve o processo completo para gerenciar o código-fonte do WhatsApp Devocional usando Git e GitHub, desde o desenvolvimento local até a implantação no servidor Raspberry Pi.

## Índice

1. [Configuração Inicial](#configuração-inicial)
2. [Fluxo de Trabalho de Desenvolvimento](#fluxo-de-trabalho-de-desenvolvimento)
3. [Comandos Git Essenciais](#comandos-git-essenciais)
4. [Processo de Atualização no Servidor](#processo-de-atualização-no-servidor)
5. [Solução de Problemas](#solução-de-problemas)

## Configuração Inicial

### 1. Configurar Git na Máquina Local

```bash
# Configurar nome e email
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"

# Configurar armazenamento de credenciais (opcional)
git config --global credential.helper store
```

### 2. Configurar Repositório no GitHub

1. Criar repositório no GitHub (vazio)
2. Copiar a URL do repositório (ex: `https://github.com/brunovdl/whatsapp-devocional-IA.git`)

### 3. Configurar Repositório Local

```bash
# Clonar repositório existente
git clone https://github.com/brunovdl/whatsapp-devocional-IA.git

# OU inicializar novo repositório
cd whatsapp-devocional
git init
git remote add origin https://github.com/brunovdl/whatsapp-devocional-IA.git
```

### 4. Criar Arquivo .gitignore

```
# Dependências
node_modules/

# Arquivos de ambiente
.env
.env.backup

# Dados sensíveis
Conversas/
whatsapp-session/
temp_audio/

# Logs
logs/
*.log
```

## Fluxo de Trabalho de Desenvolvimento

### 1. Desenvolvimento na Máquina Local

1. Clone o repositório (se ainda não o fez):
   ```bash
   git clone https://github.com/brunovdl/whatsapp-devocional-IA.git
   cd whatsapp-devocional-IA
   ```

2. Certifique-se de ter a branch correta:
   ```bash
   git checkout master
   ```

3. Faça suas alterações nos arquivos do projeto

### 2. Testar Localmente (Opcional)

```bash
npm install
npm start
```

### 3. Commit e Push

```bash
# Verificar quais arquivos foram modificados
git status

# Adicionar arquivos modificados ao stage
git add .

# OU adicionar arquivos específicos
git add src/geradorDevocional.js src/conversasHandler.js

# Criar commit com mensagem descritiva
git commit -m "Corrigido bug no registro de devocionais"

# Enviar alterações para o GitHub
git push origin master
```

### 4. Atualizar o Servidor

Acesse o servidor Raspberry Pi e execute:

```bash
cd /home/dietpi/Node.js
./update.sh
```

## Comandos Git Essenciais

### Comandos Básicos

```bash
# Ver status atual
git status

# Ver histórico de commits
git log

# Ver histórico resumido
git log --oneline

# Ver alterações não commitadas
git diff

# Descartar alterações em um arquivo
git checkout -- nome-do-arquivo.js

# Descartar todas as alterações
git reset --hard
```

### Branches

```bash
# Criar nova branch
git checkout -b nova-funcionalidade

# Mudar de branch
git checkout master

# Ver todas as branches
git branch

# Mesclar branch
git merge nova-funcionalidade
```

### Stash (Armazenamento Temporário)

```bash
# Salvar alterações temporariamente
git stash

# Recuperar alterações salvas
git stash apply

# Listar alterações salvas
git stash list

# Remover stash mais recente
git stash drop
```

## Processo de Atualização no Servidor

O script `update.sh` realiza as seguintes operações:

1. Salva configurações locais (`.env`)
2. Busca atualizações do GitHub
3. Mostra alterações disponíveis
4. Solicita confirmação
5. Aplica as atualizações
6. Restaura configurações locais
7. Instala dependências
8. Reinicia o serviço

### Conteúdo do script update.sh

```bash
#!/bin/bash
# Script para atualizar o bot a partir do GitHub

# Registrar início da atualização
echo "Iniciando atualização do WhatsApp Devocional em $(date)"

# Navegar para o diretório do projeto
cd /home/dietpi/Node.js

# Salvar arquivos locais importantes que podem ter sido modificados
echo "Salvando configurações locais..."
cp .env .env.backup 2>/dev/null || echo "Arquivo .env não encontrado para backup"

# Puxar as alterações do repositório
echo "Baixando atualizações do GitHub..."
git fetch origin master
echo "Status atual:"
git status

# Mostrar diferenças disponíveis
echo "Alterações disponíveis do repositório remoto:"
git log HEAD..origin/master --oneline

# Descartar alterações locais para evitar conflitos
git reset --hard

# Perguntar se deseja continuar
read -p "Continuar com a atualização? (s/n): " resposta
if [[ "$resposta" != "s" && "$resposta" != "S" ]]; then
    echo "Atualização cancelada."
    exit 0
fi

# Aplicar as alterações
echo "Aplicando atualizações..."
git pull origin master

# Restaurar arquivos de configuração 
echo "Restaurando configurações locais..."
cp .env.backup .env 2>/dev/null || echo "Backup do .env não encontrado, pulando restauração"

# Instalar novas dependências se necessário
echo "Verificando dependências..."
npm install --legacy-peer-deps

# Reiniciar o serviço
echo "Reiniciando o serviço..."
sudo systemctl restart whatsapp-devocional.service

# Verificar status
echo "Verificando status do serviço..."
sudo systemctl status whatsapp-devocional.service --no-pager

echo "Atualização concluída em $(date)"
```

## Solução de Problemas

### Conflitos em arquivos locais

Se o Git informar conflitos em arquivos locais:

```bash
# Salvar alterações locais temporariamente
git stash

# Puxar atualizações
git pull origin master

# Aplicar alterações locais novamente (pode gerar conflitos a serem resolvidos)
git stash apply
```

### Permissões de arquivos no servidor

Após atualizar, se houver problemas de permissão:

```bash
# Ajustar permissões dos diretórios críticos
sudo chmod -R 777 /home/dietpi/Node.js/Histórico
sudo chmod -R 777 /home/dietpi/Node.js/Conversas
sudo chmod -R 777 /home/dietpi/Node.js/whatsapp-session
sudo chmod -R 777 /home/dietpi/Node.js/temp_audio
```

### Erro de autenticação no GitHub

Se receber erro de autenticação ao fazer push:

```bash
# Configurar token de acesso pessoal (PAT)
git remote set-url origin https://SEU-USUARIO:SEU-TOKEN@github.com/brunovdl/whatsapp-devocional-IA.git
```

### Verificar status do serviço

Para verificar se o serviço está funcionando após atualizações:

```bash
# Ver status do serviço
sudo systemctl status whatsapp-devocional.service

# Ver logs recentes
sudo journalctl -u whatsapp-devocional.service -n 50
```

---

Este fluxo de trabalho permite um desenvolvimento eficiente, mantendo o código-fonte organizado e facilitando a implantação de atualizações no servidor de produção.
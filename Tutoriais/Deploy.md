# README - Comandos Linux para Deploy e Manutenção do WhatsApp Devocional

Este documento detalha todos os comandos Linux necessários para configurar, implantar e manter o sistema WhatsApp Devocional em um servidor Raspberry Pi/DietPi.

## Índice
1. [Instalação de Pré-requisitos](#1-instalação-de-pré-requisitos)
2. [Configuração do Projeto](#2-configuração-do-projeto)
3. [Configuração do Serviço Systemd](#3-configuração-do-serviço-systemd)
4. [Gerenciamento de Permissões](#4-gerenciamento-de-permissões)
5. [Gerenciamento do Serviço](#5-gerenciamento-do-serviço)
6. [Visualização de Logs](#6-visualização-de-logs)
7. [Manutenção do Sistema](#7-manutenção-do-sistema)
8. [Solução de Problemas](#8-solução-de-problemas)

## 1. Instalação de Pré-requisitos

### Atualizar o sistema
```bash
sudo apt update
sudo apt upgrade -y
```

### Instalar o Node.js
```bash
# Instalar o Node.js (recomendado versão LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### Instalar as dependências essenciais
```bash
sudo apt install -y git
```

## 2. Configuração do Projeto

### Clonar/Preparar o Projeto
```bash
# Criar diretório para o projeto
mkdir -p /home/dietpi/Node.js
cd /home/dietpi/Node.js

# Instalar dependências do projeto
npm install
```

### Criar diretórios necessários e ajustar permissões iniciais
```bash
# Criar diretórios de sistema
mkdir -p Conversas
mkdir -p Histórico
mkdir -p whatsapp-session
mkdir -p Base_de_conhecimento
mkdir -p Contatos

# Ajustar permissões iniciais
chmod -R 755 /home/dietpi/Node.js/
```

## 3. Configuração do Serviço Systemd

### Criar o arquivo de serviço
```bash
sudo nano /etc/systemd/system/whatsapp-devocional.service
```

### Conteúdo do arquivo de serviço
```ini
[Unit]
Description=WhatsApp Devocional Service
After=network.target

[Service]
Type=simple
User=dietpi
Group=dietpi
WorkingDirectory=/home/dietpi/Node.js
ExecStart=/usr/local/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=whatsapp-devocional
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Recarregar o daemon do systemd
```bash
sudo systemctl daemon-reload
```

### Habilitar o serviço para iniciar na inicialização
```bash
sudo systemctl enable whatsapp-devocional.service
```

## 4. Gerenciamento de Permissões

### Configurar permissões corretas para todos os diretórios do projeto
```bash
# Tornar o usuário dietpi proprietário de todos os arquivos
sudo chown -R dietpi:dietpi /home/dietpi/Node.js/

# Definir permissões para diretórios que precisam de escrita
sudo chmod -R 777 /home/dietpi/Node.js/Conversas/
sudo chmod -R 777 /home/dietpi/Node.js/whatsapp-session/
sudo chmod -R 777 /home/dietpi/Node.js/Histórico/
sudo chmod -R 777 /home/dietpi/Node.js/temp_audio/
```

## 5. Gerenciamento do Serviço

### Iniciar o serviço
```bash
sudo systemctl start whatsapp-devocional.service
```

### Verificar status do serviço
```bash
sudo systemctl status whatsapp-devocional.service
```

### Parar o serviço
```bash
sudo systemctl stop whatsapp-devocional.service
```

### Reiniciar o serviço
```bash
sudo systemctl restart whatsapp-devocional.service
```

### Recarregar configuração sem reiniciar
```bash
sudo systemctl reload whatsapp-devocional.service
```

## 6. Visualização de Logs

### Ver logs do serviço em tempo real
```bash
sudo journalctl -u whatsapp-devocional.service -f
```

### Ver logs do serviço com timestamps
```bash
sudo journalctl -u whatsapp-devocional.service --no-pager
```

### Ver logs das últimas 100 linhas
```bash
sudo journalctl -u whatsapp-devocional.service -n 100
```

### Ver logs desde a última inicialização
```bash
sudo journalctl -u whatsapp-devocional.service -b
```

### Ver logs de um período específico
```bash
sudo journalctl -u whatsapp-devocional.service --since "2025-04-02 12:00:00" --until "2025-04-02 14:00:00"
```

## 7. Manutenção do Sistema

### Verificar espaço em disco
```bash
df -h
```

### Verificar uso de memória
```bash
free -h
```

### Verificar processos em execução
```bash
htop  # Instale com: sudo apt install htop
```

### Verificar conexões de rede
```bash
netstat -tuln
```

### Configurar reinicialização automática semanal (bom para limpeza de memória)
```bash
sudo crontab -e
```
Adicione esta linha para reiniciar todo domingo às 4h da manhã:
```
0 4 * * 0 /sbin/reboot
```

## 8. Solução de Problemas

### Se o serviço não iniciar
Verifique primeiro os logs:
```bash
sudo journalctl -u whatsapp-devocional.service -n 50
```

### Verificar se o Node.js está funcionando corretamente
```bash
node -v
npm -v
```

### Verificar permissões dos arquivos críticos
```bash
ls -la /home/dietpi/Node.js/whatsapp-session/
ls -la /home/dietpi/Node.js/Conversas/
```

### Corrigir permissões novamente se necessário
```bash
sudo chown -R dietpi:dietpi /home/dietpi/Node.js/
sudo chmod -R 777 /home/dietpi/Node.js/Conversas/
sudo chmod -R 777 /home/dietpi/Node.js/whatsapp-session/
```

### Reiniciar o sistema em último caso
```bash
sudo reboot
```

---

Este documento cobre os comandos essenciais para o gerenciamento do WhatsApp Devocional em um servidor Linux. Consulte este guia sempre que precisar realizar manutenção ou solucionar problemas no sistema.
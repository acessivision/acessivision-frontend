# AcessiVision Frontend 👋

> Aplicativo mobile desenvolvido com React Native e Expo para promover acessibilidade digital

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Executando o Projeto](#executando-o-projeto)
- [Build de Desenvolvimento](#build-de-desenvolvimento)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Contribuindo](#contribuindo)
- [Documentação Adicional](#documentação-adicional)

## 🎯 Sobre o Projeto

O AcessiVision é um aplicativo mobile que visa proporcionar maior acessibilidade digital através de recursos inovadores. Este repositório contém o código-fonte do frontend desenvolvido com React Native e Expo.

## 📦 Pré-requisitos

Antes de começar, certifique-se de ter instalado em sua máquina:

- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
- [Git](https://git-scm.com/)
- [Expo Go](https://expo.dev/client) instalado no seu dispositivo móvel (Android ou iOS)

### ⚠️ Requisitos de Rede

> **Importante:** Seu computador e dispositivo móvel devem estar conectados à **mesma rede Wi-Fi** para o desenvolvimento local. No Windows, certifique-se de que a rede está configurada como **"Rede Privada"**.
>
> **Alternativa:** Use a flag `--tunnel` ao iniciar o aplicativo, porém isso pode tornar a execução mais lenta:
> ```bash
> npx expo start --tunnel
> ```
>
> **Nota:** O backend do projeto está hospedado em `acessivision.com.br`, então a conexão de rede local é necessária apenas para o hot-reload do Expo, não para comunicação com a API.

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/acessivision/acessivision-frontend.git
cd acessivision-frontend
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Instale o EAS CLI globalmente

O EAS CLI (Expo Application Services Command Line Interface) é necessário para builds de desenvolvimento:

```bash
npm install -g eas-cli
```

### 4. Faça login no EAS

```bash
eas login
```

> **Nota:** Você precisará criar uma conta no [Expo](https://expo.dev/) caso ainda não tenha uma.

## 🏗️ Build de Desenvolvimento

### Primeira configuração (apenas para novos projetos)

> **Atenção:** Pule esta etapa se você está clonando um projeto existente.

```bash
eas init
```

### Prebuild

Compile os arquivos nativos necessários:

```bash
npx expo prebuild
```

### Build para Android

```bash
eas build --platform android --profile development
```

### Build para iOS

```bash
eas build --platform ios --profile development
```

Após o build ser concluído:
1. Leia o QR Code exibido no terminal
2. Instale o aplicativo de desenvolvimento no seu dispositivo
3. Aguarde a instalação finalizar

## ▶️ Executando o Projeto

Após instalar o build de desenvolvimento no seu dispositivo, inicie o servidor de desenvolvimento:

```bash
npx expo start
```

### Conectando ao aplicativo

1. Abra o aplicativo de desenvolvimento instalado no seu dispositivo
2. Escaneie o QR Code exibido no terminal, **ou**
3. Digite manualmente a URL exibida no terminal

O aplicativo será carregado e você poderá ver as alterações em tempo real durante o desenvolvimento.

## 📁 Estrutura do Projeto

```
acessivision-frontend/
├── app/                 # Rotas e telas do aplicativo
├── assets/              # Imagens, fontes e outros recursos estáticos
├── components/          # Componentes reutilizáveis
├── constants/           # Constantes e configurações
├── hooks/               # Custom hooks
├── utils/               # Funções utilitárias
├── app.json             # Configurações do Expo
├── package.json         # Dependências do projeto
└── README.md            # Este arquivo
```

## 🛠️ Tecnologias Utilizadas

- [React Native](https://reactnative.dev/)
- [Expo](https://expo.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)

## 🤝 Contribuindo

Contribuições são sempre bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

### Padrões de Código

- Siga as convenções de código do projeto
- Escreva commits descritivos
- Documente novas funcionalidades

## 📚 Documentação Adicional

- [Tutorial Expo](https://docs.expo.dev/tutorial/introduction/) - Aprenda os fundamentos do Expo
- [Expo Dev Build](https://docs.expo.dev/build/setup/) - Guia completo sobre builds de desenvolvimento
- [React Native Docs](https://reactnative.dev/docs/getting-started) - Documentação oficial do React Native
- [Expo Router](https://docs.expo.dev/router/introduction/) - Sistema de roteamento file-based

## 🐛 Problemas Comuns

### O aplicativo não conecta ao servidor de desenvolvimento

- Verifique se ambos os dispositivos estão na mesma rede Wi-Fi
- Tente usar a flag `--tunnel`: `npx expo start --tunnel`
- Reinicie o servidor: pressione `r` no terminal onde o Expo está rodando

### Erro de conexão com a API

- Verifique se o backend está online em `https://acessivision.com.br`
- Verifique sua conexão com a internet

### Erro no build

- Limpe o cache: `npx expo start -c`
- Reinstale as dependências: `rm -rf node_modules && npm install`
- Verifique se o EAS CLI está atualizado: `npm install -g eas-cli@latest`

### Erro de permissões no iOS

- Certifique-se de que possui um certificado de desenvolvedor Apple válido
- Verifique as configurações de provisioning profile no EAS

## 📄 Licença

Este projeto está sob a licença [inserir licença]. Veja o arquivo `LICENSE` para mais detalhes.

## 👥 Time

Desenvolvido com ❤️ pela equipe AcessiVision

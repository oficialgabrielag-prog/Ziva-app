# Instruções — Segurança e APK da Ziva

## 1. Ficheiro .gitignore
Adiciona o ficheiro `.gitignore` à raiz do repositório.
Ele impede que node_modules, .env e ficheiros sensíveis sejam subidos ao GitHub.

## 2. Ficheiro .env.example
Adiciona o ficheiro `.env.example` à raiz do repositório.
Este ficheiro mostra QUAIS variáveis são necessárias, MAS sem os valores reais.
Cria um ficheiro `.env` (nunca subir ao GitHub) com os valores reais.

## 3. Gerar APK com EAS Build

### Pré-requisitos:
- Conta em https://expo.dev (gratuita)
- Node.js instalado no computador

### Passos:
```bash
# 1. Instalar EAS CLI
npm install -g eas-cli

# 2. Fazer login no Expo
eas login

# 3. Na pasta do projecto, configurar o build
eas build:configure

# 4. Gerar APK para Android (preview = APK directo)
eas build --platform android --profile preview
```

### Após o build:
- O EAS envia um email quando o APK estiver pronto
- Descarrega o APK directamente do painel em https://expo.dev
- Instala no Android activando "Fontes desconhecidas" nas definições

## 4. Ficheiro eas.json (já incluído no projecto)
O perfil "preview" gera um APK instalável directamente.
O perfil "production" gera um AAB para a Google Play Store.

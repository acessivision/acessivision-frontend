# Bem vindo ao Front-End do AcessiVision <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Waving%20Hand.png" alt="Waving Hand" width="50" height="50" />

Clone o repositório:
   ```bash
   git clone https://github.com/acessivision/acessivision-frontend.git
   ```

<br>

> [!IMPORTANT]
> Seu computador e seu dispositivo mobile devem estar conectados na mesma rede e, no computador, a rede deve estar configurada como privada para que o aplicativo funcione usando o Expo Go. Outra opção é usar a flag `--tunnel` ao iniciar o aplicativo, mas isso pode deixar o processo mais lento.

<br>

Após certificar-se que seu dispositivo mobile e seu computador estão na mesma rede e que o Crie o arquivo ".env" na raiz do projeto e adicione a variável abaixo.
   ```bash
   EXPO_PUBLIC_IP=<ip_do_seu_computador>
   ```

Instale as dependências

   ```bash
   npm install
   ```

Instale o EAS CLI (Expo Aplication Services Command Line Interface)
   ```bash
   npm install -g eas-cli
   ```

Faça login na sua conta do EAS Cloud
   ```bash
   eas login
   ```

> [!IMPORTANT]
> Só precisa desse próximo passo caso você esteja iniciando um projeto do zero, caso estiver conectando a um projeto já existente, ignore.
>
>   ```bash
>   eas init
>   ```

Faça o prebuild para compilar o aplicativo
```bash
npx expo prebuild
```

Faça o build do aplicativo
```bash
eas build --platform android --profile development
```
E para iOS:
```bash
eas build --platform ios --profile development
```

Leia o QR Code que aparecer no terminal, instale o aplicativo. Após isso

Inicie o app

   ```bash
    npx expo start
   ```

Dentro do app baixado, conecte no servidor usando o QR Code ou a url que aparecer no terminal.

## Documentação do Expo <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Open%20Book.webp" alt="Open Book" width="25" height="25" />
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/)
- [Expo Dev Build](https://docs.expo.dev/build/setup/)

## Bom desenvolvimento! <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Rocket.png" alt="Rocket" width="25" height="25" /><img src="https://user-images.githubusercontent.com/74038190/219923809-b86dc415-a0c2-4a38-bc88-ad6cf06395a8.gif" width="30">


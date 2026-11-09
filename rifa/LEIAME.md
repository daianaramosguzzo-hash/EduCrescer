# Rifa de 00 a 100 (GitHub Pages)

Página onde as pessoas escolhem números de **00 a 100**, reservam com nome e WhatsApp e pagam pelo **PIX** (QR Code e copia e cola com o valor certo).
O site **não faz sorteio**: ele só registra quem escolheu cada número. O resultado sai por fora (Loteria Federal, live etc.).

- **Verde:** o número que a pessoa está escolhendo
- **Amarelo:** reservado, aguardando o pagamento
- **Cinza riscado:** pago

## 1. Configurar a rifa

Edite o arquivo `rifa/config.js`: título, prêmio, preço do número, chave PIX, nome e cidade de quem recebe e, se quiser, o WhatsApp para receber os comprovantes.

Formato da chave PIX:

| Tipo | Como escrever |
|---|---|
| Celular | `+5527999999999` |
| CPF/CNPJ | só números |
| E-mail | `nome@email.com` |
| Aleatória | do jeito que o banco mostra |

> Depois de configurar, faça um PIX de teste de R$ 0,01 para conferir se o nome que aparece no banco é o seu.

## 2. Ligar a planilha (registro compartilhado)

O GitHub Pages só serve páginas, então os números escolhidos ficam numa **Planilha Google**. Sem isso, a página funciona só em **modo de teste**: cada aparelho vê apenas as próprias escolhas.

1. Crie uma planilha nova em [sheets.google.com](https://sheets.google.com).
2. Abra **Extensões → Apps Script**, apague o que estiver lá, cole todo o conteúdo de `rifa/planilha.gs` e salve.
3. Clique em **Implantar → Nova implantação**. Em tipo, escolha **App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Autorize o acesso. Se o Google avisar que o app não foi verificado, clique em **Avançado → Acessar**.
5. Copie a **URL do app da Web**. Ela termina em `/exec`. Cole em `planilhaUrl` no `config.js`.

A aba **Rifa** aparece sozinha na primeira reserva.

### Como administrar

Cada número reservado vira uma linha: `Data | Número | Nome | Telefone | Status`.

- Recebeu o PIX? Mude o **Status** para `pago`. O número fica cinza no site.
- Não pagou? Mude para `cancelado`. O número volta a ficar livre.

O telefone **não** aparece no site. Lá só aparece o primeiro nome de quem reservou.

> Se mudar o código do `planilha.gs` depois, use **Implantar → Gerenciar implantações → editar → Nova versão** para manter a mesma URL.

## 3. Publicar

Com o GitHub Pages ativo no repositório (*Settings → Pages*), a rifa fica em:

```
https://<usuario>.github.io/<repositorio>/rifa/
```

Para testar no computador: `python3 -m http.server 8000` na raiz do projeto e abra `http://localhost:8000/rifa/`.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `config.js` | Configuração da rifa |
| `index.html`, `rifa.css`, `rifa.js` | A página |
| `pix.js` | Gera o código PIX (BR Code do Banco Central, com CRC16) |
| `lib/qrcode.js` | Gera o QR Code (qrcode-generator, licença MIT) |
| `planilha.gs` | Código da planilha (Google Apps Script) |

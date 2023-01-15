# instruções


```sh
// Instação de dependências
$ npm install
```

```sh
// Configuração da orm
$ npx prisma db push
```

```sh
// Script para buscar produtos na página
$ npm run scrapper
```

```sh
// Script para rodar servidor web
$ npm run dev
```

--- 
## Rotas

- /products
  - Busca todos os produtos
  - Parâmetros opcionais
    - page (padrão = 1)
    - limit (padrão = 10)
- /products/:id
  - Busca produto único ( /products/548 por exemplo)
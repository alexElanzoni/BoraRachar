## Rodando localmente

1. Clone o repositório:
```bash
git clone https://github.com/SEU-USUARIO/BoraRachar.git
cd BoraRachar
```

2. Crie um projeto gratuito em [supabase.com](https://supabase.com)

3. No painel do Supabase, crie 3 tabelas:

**viagens**
| coluna | tipo |
|--------|------|
| id | uuid (gerado automático) |
| nome | text |
| codigo | text |

**usuarios**
| coluna | tipo |
|--------|------|
| id | uuid (gerado automático) |
| nome | text |
| viagem_id | uuid (referência → viagens.id) |

**gastos**
| coluna | tipo |
|--------|------|
| id | uuid (gerado automático) |
| descricao | text |
| valor | numeric |
| data | date |
| quem_pagou | uuid (referência → usuarios.id) |
| participantes | uuid[] |
| viagem_id | uuid (referência → viagens.id) |

4. No arquivo `script.js`, substitua as linhas abaixo com os dados do seu projeto:
```js
const SUPABASE_URL = 'sua_url_aqui';
const SUPABASE_KEY = 'sua_chave_aqui';
```
Você encontra esses valores em **Project Settings → API** no painel do Supabase.

5. Abra o `index.html` no navegador — não precisa de servidor.

---

## Estrutura do projeto

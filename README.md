# Estudantil — PWA

App estudantil **simples e rápido**: tarefas, disciplinas, notas e timer Pomodoro.
Sem build, sem dependências, sem framework. Roda offline e instala como app no celular.

```
node server.js          # ou: npm start
# → http://localhost:4173
```

## Recursos

| Aba | O que faz |
|---|---|
| **Hoje** | Progresso do dia, tarefas para hoje, próximos prazos e gráfico de 7 dias |
| **Tarefas** | CRUD com disciplina, prioridade, data de entrega e busca/filtros |
| **Disciplinas** | Matérias com cor própria, pendências e média calculada |
| **Notas** | Lançamento de avaliações com peso → média ponderada por disciplina |
| **Timer** | Pomodoro (25/5/15) que continua rodando mesmo se você fechar a aba |

Extras: tema claro/escuro automático, backup em JSON (exportar/importar), atalhos de teclado
(`n` nova tarefa, `t` timer, `1`/`2` navegar) e dados 100% locais (`localStorage`).

## Estrutura

```
index.html            # shell da aplicação
manifest.webmanifest  # manifesto do PWA
sw.js                 # service worker (cache offline)
server.js             # servidor estático sem dependências
css/styles.css        # estilos (variáveis CSS para tema)
js/store.js           # estado, persistência e regras
js/app.js             # renderização e eventos
icons/                # ícones do app
tools/make_icons.py   # gera os ícones PNG sem dependências
```

## Instalar como app

1. Rode o servidor e abra `http://localhost:4173` (ou o IP da máquina na mesma rede, pelo celular).
2. No Chrome/Edge desktop: ícone de instalar na barra de endereços.
   No Android: menu → **Instalar app**. No iOS: Compartilhar → **Adicionar à Tela de Início**.

O service worker exige `http://localhost` ou HTTPS. Para publicar, sirva os arquivos
estáticos em qualquer hospedagem (GitHub Pages, Netlify, Vercel).

## Ajustes rápidos

- **Duração do Pomodoro**: Ajustes → Foco / Pausa curta / Pausa longa.
- **Mudar tema**: botão "Tema" (ciclo claro → escuro → automático) ou Ajustes.
- **Backup**: Ajustes → Exportar gera um `.json`; Importar restaura.

## Regenerar ícones

```bash
python3 tools/make_icons.py
```

## Licença

MIT

# Documento de Requisitos

## 1. Visão Geral da Aplicação

**Nome da Aplicação:** Ziva Omega

**Descrição:** Ziva Omega é uma rede social mobile que permite aos usuários compartilhar conteúdo em múltiplos formatos (texto, foto, múltiplas imagens, vídeo, reel, story), interagir através de 9 tipos de reações, comentários aninhados e mensagens diretas completas, seguir outros usuários e receber notificações em tempo real. A aplicação inclui feed inteligente com carregamento progressivo e algoritmo de pontuação, reels com pré-carregamento, stories com destaques e arquivamento, pesquisa unificada com voz e imagem, comunidades, sistema de verificação, denúncias e moderação, e assistente de inteligência artificial Ziva IA com memória personalizada, compreensão multimodal e geração de conteúdo. Desenvolvida com Expo SDK 55, React Native e Supabase.

**Objetivo Principal:** Criar uma experiência social mobile completa e fluida onde usuários possam se conectar, compartilhar momentos em múltiplos formatos, consumir conteúdo personalizado através de algoritmo inteligente, participar de comunidades, interagir com inteligência artificial avançada de forma intuitiva, com identidade visual premium, performance otimizada, segurança robusta e foco na comunidade de língua portuguesa de Angola.

## 2. Usuários e Cenários de Uso

**Personas:**

- **Persona 1 - Usuário Ativo (18-35 anos)**
  - Compartilha conteúdo diariamente em múltiplos formatos incluindo carrosséis de imagens
  - Utiliza assistente de publicação com IA para sugestões de legenda, hashtags e horário
  - Interage com posts através de 9 tipos de reações
  - Utiliza stories com destaques e arquivamento
  - Troca mensagens com texto, fotos, vídeos e áudios
  - Assiste e cria Reels com reprodução contínua
  - Utiliza Ziva IA com memória personalizada e compreensão multimodal
  - Pesquisa pessoas, publicações, reels, stories e hashtags usando voz ou imagem
  - Personaliza perfil com foto de capa e username único
  - Cria e participa de comunidades
  - Solicita verificação de conta
  - Denuncia conteúdo inadequado
  - Ativa autenticação em dois fatores

- **Persona 2 - Usuário Casual (25-45 anos)**
  - Acessa para acompanhar atualizações no feed inteligente com algoritmo de pontuação
  - Interage ocasionalmente com reações rápidas
  - Busca conteúdo específico através da pesquisa unificada
  - Mantém conexões com conhecidos
  - Consulta Ziva IA para informações
  - Personaliza configurações de privacidade, notificações e acessibilidade
  - Recebe sugestões de amigos, criadores e comunidades

- **Persona 3 - Criador de Conteúdo (20-40 anos)**
  - Publica conteúdo regularmente com assistência de IA
  - Acessa Creator Studio para visualizar analytics
  - Solicita verificação de conta
  - Gera imagens e vídeos curtos usando Ziva IA
  - Administra comunidades

**Cenários de Uso:**

- Usuário acessa o feed inteligente com skeleton loaders e vê atualizações priorizadas por algoritmo de pontuação
- Usuário publica texto, foto única, múltiplas imagens em carrossel, vídeo, reel ou story com sugestões de IA
- Usuário reage a publicações com 9 tipos de reações
- Usuário visualiza e publica stories temporários com destaques e arquivamento
- Usuário envia mensagens diretas com texto, fotos, vídeos, áudios e emojis
- Usuário busca pessoas, publicações, reels, stories e hashtags usando voz ou imagem
- Usuário assiste Reels com pré-carregamento do próximo vídeo
- Usuário grava e publica Reels que aparecem automaticamente em múltiplas seções
- Usuário conversa com Ziva IA que lembra conversas anteriores e compreende áudio, documentos e vídeos
- Usuário gera imagens e vídeos curtos usando Ziva IA
- Usuário pesquisa informações em tempo real com Ziva IA
- Usuário faz chamadas de voz com Ziva IA
- Usuário personaliza perfil com foto de capa e username único editável
- Usuário responde a comentários criando threads aninhados
- Usuário personaliza configurações de conta, privacidade, segurança, notificações, idioma, tema, armazenamento, acessibilidade e IA
- Usuário cria comunidade e convida membros
- Usuário entra em comunidade e publica conteúdo
- Usuário solicita verificação de conta
- Usuário denuncia publicação, comentário ou perfil inadequado
- Usuário ativa autenticação em dois fatores
- Usuário recebe sugestões de amigos, criadores e comunidades
- Usuário acessa Creator Studio para visualizar analytics
- Sistema recupera automaticamente após falhas de conexão

## 3. Estrutura de Páginas e Funcionalidades

### 3.1 Estrutura de Navegação

```
Ziva Omega
├── Autenticação
│   ├── Tela de Login
│   └── Tela de Registro
├── Feed Inteligente (com algoritmo de pontuação)
├── Reels
├── Stories
├── Ziva IA
│   ├── Chat com IA (com memória e compreensão multimodal)
│   ├── Geração de Imagens
│   ├── Geração de Vídeos Curtos
│   ├── Pesquisa em Tempo Real
│   └── Chamadas de Voz
├── Pesquisa Unificada
│   ├── Pesquisa por Texto
│   ├── Pesquisa por Voz
│   ├── Pesquisa por Imagem
│   ├── Pessoas
│   ├── Publicações
│   ├── Reels
│   ├── Stories
│   ├── Hashtags
│   └── Comunidades
├── Explorar
├── Comunidades
│   ├── Descobrir Comunidades
│   ├── Minhas Comunidades
│   ├── Criar Comunidade
│   └── Página da Comunidade
├── Notificações
├── Mensagens
│   └── Chat Individual
├── Perfil
│   ├── Perfil Próprio
│   │   ├── Foto de Capa
│   │   ├── Username Único
│   │   ├── Badge de Verificação
│   │   ├── Tab Publicações
│   │   ├── Tab Reels
│   │   ├── Tab Fotos
│   │   ├── Tab Vídeos
│   │   ├── Tab Stories
│   │   ├── Tab Curtidas
│   │   ├── Tab Salvos
│   │   └── Tab Comunidades
│   └── Perfil de Outros Usuários
├── Creator Studio
│   └── Analytics
├── Sugestões
│   ├── Amigos Sugeridos
│   ├── Criadores Sugeridos
│   └── Comunidades Sugeridas
└── Configurações
    ├── Conta
    ├── Privacidade
    ├── Segurança
    │   └── Autenticação em Dois Fatores
    ├── Notificações
    ├── Idioma
    ├── Tema
    ├── Armazenamento
    ├── Acessibilidade
    ├── Gestão IA
    ├── Verificação de Conta
    └── Ajuda
        └── Denunciar
```

### 3.2 Funcionalidades por Tela

#### 3.2.1 Tela de Registro
- Usuário insere nome, email e senha
- Usuário confirma registro
- Sistema cria conta e redireciona para o feed
- Sistema implementa proteção contra força bruta

#### 3.2.2 Tela de Login
- Usuário insere email e senha
- Usuário pode ativar autenticação em dois fatores (2FA/TOTP)
- Usuário acessa a aplicação
- Sistema valida credenciais e redireciona para o feed
- Sistema implementa proteção contra força bruta

#### 3.2.3 Feed Inteligente
- Exibe publicações de usuários seguidos priorizadas por algoritmo de pontuação
- Algoritmo considera: curtidas, comentários, partilhas, tempo assistido, proximidade do utilizador, recência
- Sistema exibe skeleton loaders durante carregamento
- Cada publicação mostra: foto de perfil do autor, nome, username, badge de verificação (se aplicável), conteúdo (texto/imagem única/carrossel de múltiplas imagens/vídeo), timestamp, contadores de reações e comentários
- Carrossel de imagens permite navegação horizontal entre múltiplas fotos
- Usuário pode reagir com 9 tipos de reações: 👍 Gostei, ❤️ Amei, 😂 Haha, 😮 Uau, 😢 Triste, 😡 Grr, 👏 Palmas, 🔥 Fogo, 💜 Ziva
- Usuário pode comentar publicações
- Usuário pode guardar publicações
- Usuário pode partilhar publicações
- Usuário pode denunciar publicações
- Usuário pode criar nova publicação (texto, foto única, múltiplas imagens, vídeo, reel, story)
- Sistema oferece assistente de publicação com IA: sugestões de legenda, hashtags relevantes, correção ortográfica, horário recomendado
- Sistema atualiza feed automaticamente via Supabase Realtime
- Sistema implementa lazy loading para carregar conteúdo sob demanda
- Sistema implementa cache inteligente para conteúdo já visualizado
- Sistema recupera automaticamente após falhas de conexão
- Botão para acessar stories no topo
- Animações fluidas entre ações

#### 3.2.4 Reels
- Feed vertical de vídeos curtos em tela cheia com reprodução automática
- Sistema pré-carrega próximo vídeo para reprodução contínua
- Scroll infinito para próximo/anterior Reel
- Cada Reel mostra: vídeo, foto de perfil do autor, nome, username, badge de verificação (se aplicável), descrição, timestamp, contador de visualizações
- Usuário pode reagir com 9 tipos de reações
- Usuário pode comentar Reels
- Usuário pode guardar Reels
- Usuário pode partilhar Reels
- Usuário pode denunciar Reels
- Botão para gravar novo Reel
- Botão para fazer upload de vídeo da galeria
- Usuário pode adicionar descrição ao publicar Reel
- Sistema oferece assistente de publicação com IA: sugestões de legenda, hashtags relevantes, horário recomendado
- Sistema cria miniatura automática
- Algoritmo de recomendação sugere Reels com base em pontuação: curtidas, comentários, partilhas, tempo assistido, proximidade do utilizador, recência
- Performance otimizada para reprodução sem travamentos
- Sistema implementa upload resiliente com retry automático

#### 3.2.5 Stories
- Exibe stories de usuários seguidos
- Stories aparecem como círculos com foto de perfil no topo do feed
- Usuário pode visualizar story tocando no círculo
- Usuário pode criar novo story (foto, vídeo ou texto)
- Usuário pode adicionar sobreposições de texto e stickers ao story
- Usuário pode adicionar reações rápidas (emojis) aos stories
- Usuário pode responder a story com áudio
- Sistema mostra visualizações do story
- Stories desaparecem após 24 horas
- Usuário pode arquivar stories antes de expirarem
- Usuário pode criar destaques (highlights) no perfil com stories salvos
- Destaques permanecem visíveis no perfil indefinidamente
- Sistema implementa upload resiliente com retry automático

#### 3.2.6 Ziva IA

**Identidade Visual:**
- Novo ícone abstrato premium baseado em brilho e formas abstratas sem aparência de robô
- Animação de pulso suave no ícone

**Chat com IA:**
- Interface de chat com assistente Ziva IA
- Usuário envia mensagens de texto em português de Angola
- Usuário pode enviar áudio para IA compreender
- Usuário pode enviar documentos para IA analisar
- Usuário pode enviar vídeos para IA compreender
- IA responde em português de Angola
- Sistema guarda histórico de conversas no Supabase (memória por usuário)
- IA lembra conversas anteriores e contexto do usuário
- Sistema implementa retry automático e fila inteligente para evitar erro 429

**Geração de Imagens:**
- Usuário insere descrição em texto
- Usuário pode fazer upload de imagem de referência
- Sistema gera imagem usando Kling AI
- Usuário pode salvar imagem gerada

**Geração de Vídeos Curtos:**
- Usuário insere descrição em texto
- Usuário pode fazer upload de imagem de referência
- Sistema gera vídeo curto usando Kling AI
- Usuário pode salvar vídeo gerado

**Pesquisa em Tempo Real:**
- Usuário insere pergunta sobre qualquer assunto
- Sistema busca informações atualizadas usando AI Search
- IA apresenta resposta com fontes

**Conhecimento em Medicina Angolana:**
- Usuário faz perguntas sobre saúde e medicina
- IA fornece informações especializadas sobre medicina angolana

**Chamadas de Voz:**
- Usuário inicia chamada de voz com IA
- Sistema converte fala do usuário em texto (STT)
- IA processa e responde
- Sistema converte resposta da IA em fala (TTS) em português de Angola
- Usuário pode encerrar chamada

#### 3.2.7 Pesquisa Unificada
- Campo de busca para encontrar pessoas, publicações, reels, stories, hashtags e comunidades
- Usuário pode pesquisar por texto
- Usuário pode pesquisar por voz
- Usuário pode pesquisar por imagem
- Tab Pessoas: exibe resultados com foto de perfil, nome, username e badge de verificação (se aplicável)
- Tab Publicações: exibe publicações que correspondem à busca
- Tab Reels: exibe reels relacionados
- Tab Stories: exibe stories ativos relacionados
- Tab Hashtags: exibe hashtags populares e relacionadas
- Tab Comunidades: exibe comunidades relacionadas
- Usuário pode acessar perfil dos resultados
- Usuário pode seguir/deixar de seguir diretamente dos resultados
- Usuário pode interagir com conteúdo encontrado

#### 3.2.8 Explorar
- Exibe publicações de todos os usuários (não apenas seguidos)
- Algoritmo sugere conteúdo relevante com base em pontuação
- Usuário pode descobrir novos perfis e conteúdos
- Usuário pode interagir com publicações

#### 3.2.9 Comunidades

**Descobrir Comunidades:**
- Exibe lista de comunidades disponíveis
- Usuário pode pesquisar comunidades
- Usuário pode visualizar detalhes da comunidade
- Usuário pode entrar em comunidade

**Minhas Comunidades:**
- Exibe lista de comunidades que o usuário participa
- Usuário pode acessar página da comunidade

**Criar Comunidade:**
- Usuário insere nome da comunidade
- Usuário insere descrição da comunidade
- Usuário define foto de capa da comunidade
- Usuário define privacidade (pública ou privada)
- Sistema cria comunidade e define usuário como administrador

**Página da Comunidade:**
- Exibe foto de capa, nome, descrição, número de membros
- Exibe publicações da comunidade
- Usuário pode publicar conteúdo na comunidade
- Usuário pode reagir e comentar publicações
- Administrador pode moderar conteúdo
- Administrador pode remover membros
- Administrador pode convidar membros

#### 3.2.10 Notificações
- Lista de notificações sobre: novos seguidores, reações, comentários, respostas a comentários, menções, partilhas, stories, mensagens, comunidades, verificação de conta
- Cada notificação mostra: tipo de ação, usuário que realizou, timestamp
- Usuário pode tocar na notificação para ver o conteúdo relacionado
- Notificações não lidas aparecem destacadas
- Sistema atualiza notificações em tempo real

#### 3.2.11 Mensagens
- Lista de conversas recentes
- Cada conversa mostra: foto de perfil, nome do usuário, username, última mensagem, timestamp, estado (a escrever, a gravar áudio, enviado, entregue, visualizado)
- Usuário pode iniciar nova conversa
- Usuário pode acessar chat individual

#### 3.2.12 Chat Individual
- Exibe histórico de mensagens entre dois usuários
- Usuário pode enviar mensagens de texto
- Usuário pode enviar fotos
- Usuário pode enviar vídeos
- Usuário pode enviar áudios
- Usuário pode enviar emojis
- Mensagens aparecem em ordem cronológica
- Sistema mostra estados: a escrever, a gravar áudio, enviado, entregue, visualizado
- Sistema implementa sincronização em tempo real

#### 3.2.13 Perfil Próprio
- Exibe foto de capa editável
- Exibe foto de perfil, nome, username único editável (@utilizador), badge de verificação (se aplicável), bio
- Mostra contadores: publicações, seguidores, seguindo
- Mostra estatísticas de visualizações e interações
- Tabs de conteúdo:
  - **Publicações**: grid com todas as publicações
  - **Reels**: grid com todos os reels
  - **Fotos**: grid com todas as fotos
  - **Vídeos**: grid com todos os vídeos
  - **Stories**: destaques de stories salvos
  - **Curtidas**: publicações que o usuário curtiu
  - **Salvos**: publicações que o usuário guardou
  - **Comunidades**: comunidades que o usuário participa
- Toda publicação criada aparece imediatamente no perfil
- Usuário pode editar perfil (foto de capa, foto de perfil, nome, username, bio)
- Usuário pode solicitar verificação de conta
- Usuário pode acessar Creator Studio
- Usuário pode acessar configurações
- Usuário pode fazer logout

#### 3.2.14 Perfil de Outros Usuários
- Exibe foto de capa
- Exibe foto de perfil, nome, username, badge de verificação (se aplicável), bio
- Mostra contadores: publicações, seguidores, seguindo
- Tabs de conteúdo: Publicações, Reels, Fotos, Vídeos, Stories, Comunidades
- Botão para seguir/deixar de seguir
- Botão para enviar mensagem
- Botão para denunciar perfil

#### 3.2.15 Comentários
- Usuário pode escrever comentário com texto e emojis
- Usuário pode responder a comentários existentes criando threads aninhados
- Usuário pode curtir comentários
- Usuário pode editar seus próprios comentários
- Usuário pode apagar seus próprios comentários
- Usuário pode fixar comentários em suas próprias publicações
- Usuário pode enviar áudio como comentário
- Usuário pode denunciar comentários
- Sistema mostra autor, username, badge de verificação (se aplicável), conteúdo e timestamp de cada comentário
- Sistema exibe respostas aninhadas com indentação visual
- Sistema implementa moderação inteligente para detectar conteúdo inadequado

#### 3.2.16 Reações
- Sistema mostra 9 tipos de reações disponíveis: 👍 Gostei, ❤️ Amei, 😂 Haha, 😮 Uau, 😢 Triste, 😡 Grr, 👏 Palmas, 🔥 Fogo, 💜 Ziva
- Usuário pode selecionar uma reação para publicação
- Sistema mostra lista de quem reagiu e com qual reação
- Contadores de reações atualizam em tempo real

#### 3.2.17 Creator Studio
- Exibe analytics de publicações: visualizações, curtidas, comentários, partilhas, alcance
- Exibe analytics de reels: visualizações, tempo assistido, curtidas, comentários
- Exibe analytics de stories: visualizações, respostas
- Exibe analytics de perfil: crescimento de seguidores, engajamento
- Usuário pode visualizar dados por período (dia, semana, mês)

#### 3.2.18 Sugestões

**Amigos Sugeridos:**
- Sistema sugere usuários com base no grafo social e preferências
- Exibe foto de perfil, nome, username, badge de verificação (se aplicável)
- Usuário pode seguir diretamente

**Criadores Sugeridos:**
- Sistema sugere criadores de conteúdo relevantes
- Exibe foto de perfil, nome, username, badge de verificação (se aplicável)
- Usuário pode seguir diretamente

**Comunidades Sugeridas:**
- Sistema sugere comunidades com base em interesses
- Exibe foto de capa, nome, descrição, número de membros
- Usuário pode entrar diretamente

#### 3.2.19 Configurações

**Conta:**
- Usuário pode alterar nome
- Usuário pode alterar username único
- Usuário pode alterar email
- Usuário pode alterar avatar
- Usuário pode alterar foto de capa

**Privacidade:**
- Usuário pode definir perfil como público ou privado

**Segurança:**
- Usuário pode alterar palavra-passe
- Usuário pode ativar autenticação em dois fatores (2FA/TOTP via Supabase MFA)
- Sistema implementa proteção contra força bruta

**Notificações:**
- Usuário pode ligar/desligar notificações por tipo (curtidas, comentários, respostas, menções, novos seguidores, partilhas, stories, mensagens, comunidades, verificação)

**Idioma:**
- Usuário pode escolher idioma

**Tema:**
- Usuário pode escolher tema claro ou escuro

**Armazenamento:**
- Usuário pode visualizar uso de armazenamento
- Usuário pode limpar cache

**Acessibilidade:**
- Usuário pode ajustar tamanho de fonte
- Usuário pode ativar modo de alto contraste

**Gestão IA:**
- Usuário pode personalizar personalidade da Ziva IA
- Usuário pode ativar/desativar memória de conversas

**Verificação de Conta:**
- Usuário pode solicitar verificação de conta
- Sistema analisa solicitação
- Sistema concede badge azul se aprovado

**Ajuda:**
- Usuário pode denunciar conteúdo ou usuário
- Usuário pode eliminar conta

## 4. Regras de Negócio e Lógica

### 4.1 Autenticação
- Email deve ser único no sistema
- Senha deve ter mínimo de 6 caracteres
- Sessão permanece ativa até logout explícito
- Sistema implementa proteção contra força bruta
- Usuário pode ativar autenticação em dois fatores (2FA/TOTP via Supabase MFA)

### 4.2 Publicações
- Usuário pode criar publicações com texto, foto única, múltiplas imagens (carrossel), vídeo, reel ou story
- Sistema oferece assistente de publicação com IA: sugestões de legenda, hashtags relevantes, correção ortográfica, horário recomendado
- Sistema valida conteúdo antes de publicar
- Sistema guarda publicação automaticamente em base de dados e Storage
- Sistema implementa upload resiliente com retry automático
- Sistema cria miniatura automática para vídeos
- Sistema previne duplicação de publicações
- Publicação aparece imediatamente no Feed, Perfil, Feed dos seguidores, Pesquisa, Explorar e Hashtags
- Contadores (reações, comentários, visualizações, partilhas) atualizam em tempo real
- Sistema implementa moderação inteligente para detectar conteúdo inadequado

### 4.3 Feed Inteligente
- Feed exibe publicações de usuários seguidos priorizadas por algoritmo de pontuação
- Algoritmo considera: curtidas, comentários, partilhas, tempo assistido, proximidade do utilizador, recência
- Sistema exibe skeleton loaders durante carregamento inicial
- Sistema atualiza feed automaticamente via Supabase Realtime
- Toda publicação criada aparece imediatamente no feed dos seguidores
- Publicações aparecem em ordem de pontuação
- Sistema implementa lazy loading para performance
- Sistema implementa cache inteligente para conteúdo já visualizado
- Sistema recupera automaticamente após falhas de conexão

### 4.4 Reels
- Reels são vídeos curtos em formato vertical
- Reprodução automática em tela cheia
- Sistema pré-carrega próximo vídeo para reprodução contínua sem travamentos
- Scroll infinito para navegação
- Contador de visualizações atualiza em tempo real
- Algoritmo de recomendação sugere Reels com base em pontuação: curtidas, comentários, partilhas, tempo assistido, proximidade do utilizador, recência
- Reels aparecem automaticamente no Feed, Perfil, Pesquisa e Explorar
- Sistema implementa upload resiliente com retry automático

### 4.5 Stories
- Stories ficam visíveis por 24 horas após publicação
- Apenas seguidores podem visualizar stories
- Usuário pode publicar múltiplos stories
- Usuário pode adicionar sobreposições de texto e stickers
- Usuário pode responder a story com áudio
- Sistema registra visualizações
- Usuário pode arquivar stories antes de expirarem
- Usuário pode criar destaques (highlights) no perfil com stories salvos
- Destaques permanecem visíveis indefinidamente
- Reações rápidas (emojis) são permitidas
- Sistema implementa upload resiliente com retry automático

### 4.6 Ziva IA
- Todas as funcionalidades da IA são operacionais e funcionais
- Chat processa mensagens em português de Angola
- IA compreende áudio, documentos e vídeos enviados pelo usuário
- Sistema guarda histórico de conversas no Supabase (memória por usuário)
- IA lembra conversas anteriores e contexto do usuário
- Sistema implementa retry automático e fila inteligente para evitar erro 429
- Geração de imagens utiliza Kling AI
- Geração de vídeos curtos utiliza Kling AI
- Pesquisa em tempo real utiliza AI Search
- Chamadas de voz utilizam TTS e STT em português de Angola
- IA possui conhecimento especializado em medicina angolana

### 4.7 Reações
- Usuário pode reagir a publicações e reels com 9 tipos de reações
- Cada usuário pode dar apenas uma reação por publicação
- Usuário pode alterar reação
- Sistema mostra lista de quem reagiu e com qual reação
- Contadores atualizam em tempo real

### 4.8 Comentários
- Usuário pode comentar publicações e reels
- Usuário pode responder a comentários criando threads aninhados
- Usuário pode curtir comentários
- Usuário pode editar seus próprios comentários
- Usuário pode apagar apenas seus próprios comentários
- Usuário pode fixar comentários em suas próprias publicações
- Usuário pode enviar áudio como comentário
- Usuário pode denunciar comentários
- Sistema mostra autor, username, badge de verificação (se aplicável), conteúdo e timestamp
- Sistema exibe respostas aninhadas com indentação visual
- Sistema implementa moderação inteligente para detectar conteúdo inadequado

### 4.9 Relacionamentos
- Seguir é unidirecional (A pode seguir B sem B seguir A)
- Usuário pode deixar de seguir a qualquer momento
- Contador de seguidores/seguindo atualiza em tempo real

### 4.10 Mensagens
- Mensagens são privadas entre dois usuários
- Usuário pode enviar texto, fotos, vídeos, áudios e emojis
- Sistema mostra estados: a escrever, a gravar áudio, enviado, entregue, visualizado
- Histórico de mensagens é preservado
- Sistema implementa sincronização em tempo real

### 4.11 Notificações
- Sistema gera notificação quando: alguém segue o usuário, reage a publicação, comenta publicação, responde a comentário, menciona usuário, partilha publicação, publica story, envia mensagem, atividade em comunidade, verificação de conta aprovada
- Notificações são armazenadas e podem ser visualizadas posteriormente
- Usuário pode configurar quais tipos de notificações deseja receber

### 4.12 Pesquisa
- Sistema permite pesquisar pessoas, publicações, reels, stories, hashtags e comunidades de forma unificada
- Usuário pode pesquisar por texto, voz ou imagem
- Resultados aparecem em tabs separadas
- Pesquisa é atualizada em tempo real conforme usuário digita

### 4.13 Privacidade
- Perfil público: qualquer usuário pode ver publicações
- Perfil privado: apenas seguidores aprovados podem ver publicações

### 4.14 Username
- Username deve ser único no sistema
- Username segue formato @utilizador
- Usuário pode editar username a qualquer momento
- Sistema valida unicidade antes de salvar

### 4.15 Comunidades
- Usuário pode criar comunidade definindo nome, descrição, foto de capa e privacidade
- Criador da comunidade torna-se administrador
- Administrador pode moderar conteúdo, remover membros e convidar membros
- Usuário pode entrar em comunidades públicas
- Usuário pode solicitar entrada em comunidades privadas
- Usuário pode publicar conteúdo na comunidade
- Usuário pode reagir e comentar publicações da comunidade

### 4.16 Verificação de Conta
- Usuário pode solicitar verificação de conta
- Sistema analisa solicitação com base em critérios definidos
- Sistema concede badge azul se aprovado
- Badge azul aparece ao lado do username em todo o aplicativo

### 4.17 Denúncias e Moderação
- Usuário pode denunciar publicações, comentários e perfis
- Sistema registra denúncia
- Sistema implementa moderação inteligente para detectar conteúdo inadequado automaticamente
- Administradores de comunidades podem moderar conteúdo em suas comunidades

### 4.18 Sugestões
- Sistema sugere amigos com base no grafo social e preferências
- Sistema sugere criadores de conteúdo relevantes
- Sistema sugere comunidades com base em interesses
- Sugestões atualizam periodicamente

### 4.19 Performance e Estabilidade
- Sistema implementa lazy loading para carregar conteúdo sob demanda
- Sistema exibe skeleton loaders durante carregamento
- Sistema comprime imagens antes de upload
- Sistema utiliza cache inteligente para conteúdo já visualizado
- Sistema realiza upload e processamento em segundo plano
- Sistema sincroniza dados em tempo real via Supabase Realtime
- Sistema implementa upload resiliente com retry automático
- Sistema recupera automaticamente após falhas de conexão

### 4.20 Segurança
- Sistema implementa proteção contra força bruta
- Sistema oferece autenticação em dois fatores (2FA/TOTP via Supabase MFA)
- Mensagens são armazenadas de forma segura

## 5. Exceções e Casos Limite

| Situação | Comportamento |
|----------|---------------|
| Email já cadastrado no registro | Sistema exibe mensagem de erro e solicita outro email |
| Credenciais inválidas no login | Sistema exibe mensagem de erro |
| Tentativas excessivas de login | Sistema bloqueia temporariamente e exibe mensagem |
| Username já existente | Sistema exibe mensagem de erro e solicita outro username |
| Tentativa de seguir usuário já seguido | Sistema ignora ação |
| Tentativa de reagir a publicação já reagida | Sistema altera reação para nova selecionada |
| Usuário sem publicações no perfil | Exibe mensagem indicando ausência de publicações |
| Feed sem conteúdo (não segue ninguém) | Exibe mensagem sugerindo buscar usuários ou explorar |
| Falha no upload de imagem | Sistema implementa retry automático e exibe mensagem se falhar |
| Falha no upload de vídeo | Sistema implementa retry automático e exibe mensagem se falhar |
| Falha no upload de múltiplas imagens | Sistema implementa retry automático e exibe mensagem indicando quais imagens falharam |
| Usuário tenta editar perfil de outro usuário | Sistema não permite ação |
| Falha na geração de imagem pela IA | Sistema exibe mensagem de erro e permite nova tentativa |
| Falha na geração de vídeo pela IA | Sistema exibe mensagem de erro e permite nova tentativa |
| Falha na pesquisa em tempo real | Sistema exibe mensagem de erro |
| Falha na chamada de voz com IA | Sistema exibe mensagem de erro e encerra chamada |
| Erro 429 na Ziva IA | Sistema implementa retry automático com fila inteligente |
| Tentativa de comentar sem texto | Sistema não permite envio |
| Tentativa de editar comentário de outro usuário | Sistema não permite ação |
| Tentativa de apagar comentário de outro usuário | Sistema não permite ação |
| Tentativa de fixar comentário em publicação de outro usuário | Sistema não permite ação |
| Story expirado (mais de 24h) | Sistema remove story automaticamente |
| Perfil privado acessado por não seguidor | Sistema exibe mensagem indicando perfil privado |
| Falha na conexão Supabase Realtime | Sistema tenta reconectar automaticamente |
| Tentativa de criar publicação duplicada | Sistema previne duplicação e exibe mensagem |
| Falha no pré-carregamento de Reel | Sistema tenta carregar novamente ao avançar |
| Tentativa de criar comunidade com nome duplicado | Sistema exibe mensagem de erro |
| Tentativa de entrar em comunidade privada sem aprovação | Sistema envia solicitação ao administrador |
| Tentativa de denunciar conteúdo próprio | Sistema não permite ação |
| Falha na pesquisa por voz | Sistema exibe mensagem de erro |
| Falha na pesquisa por imagem | Sistema exibe mensagem de erro |
| Tentativa de solicitar verificação sem critérios | Sistema exibe mensagem indicando requisitos |
| Falha na ativação de 2FA | Sistema exibe mensagem de erro e permite nova tentativa |
| Perda de conexão durante upload | Sistema retoma upload automaticamente quando conexão restaurada |

## 6. Critérios de Aceitação

1. Usuário completa registro com email e senha
2. Usuário faz login e acessa o feed inteligente com skeleton loaders
3. Usuário cria e publica carrossel com múltiplas imagens usando assistente de IA para sugestões de legenda e hashtags
4. Publicação aparece imediatamente no Feed, Perfil e Feed dos seguidores priorizados por algoritmo de pontuação
5. Usuário reage a publicação com uma das 9 reações disponíveis
6. Contador de reações atualiza em tempo real
7. Usuário acessa aba Reels e assiste vídeos com reprodução automática e pré-carregamento
8. Usuário grava e publica um Reel que aparece automaticamente em múltiplas seções
9. Usuário cria story com foto, adiciona sobreposição de texto e cria destaque no perfil
10. Story expira automaticamente após 24 horas
11. Usuário acessa Ziva IA e envia mensagem de texto
12. Ziva IA responde em português de Angola lembrando conversa anterior
13. Usuário envia áudio para Ziva IA e recebe resposta compreendendo o conteúdo
14. Usuário gera vídeo curto usando Ziva IA
15. Usuário pesquisa hashtag usando voz na pesquisa unificada e encontra publicações, reels e stories relacionados
16. Usuário envia mensagem com foto, vídeo e áudio para outro usuário
17. Sistema mostra estado visualizado na mensagem
18. Usuário edita perfil adicionando foto de capa e alterando username único
19. Usuário responde a comentário criando thread aninhado
20. Usuário cria comunidade e convida membros
21. Usuário publica conteúdo na comunidade
22. Usuário solicita verificação de conta
23. Sistema concede badge azul após aprovação
24. Usuário denuncia publicação inadequada
25. Sistema implementa moderação inteligente e detecta conteúdo inadequado
26. Usuário ativa autenticação em dois fatores
27. Usuário acessa Creator Studio e visualiza analytics de publicações
28. Usuário recebe sugestões de amigos, criadores e comunidades
29. Sistema recupera automaticamente após falha de conexão
30. Usuário acessa Configurações e altera tema para escuro
31. Usuário faz logout da aplicação

## 7. Funcionalidades Não Implementadas Nesta Versão

- Recuperação de senha
- Autenticação com redes sociais (Google, Facebook)
- Transmissão ao vivo
- Marketplace
- Enquetes
- Localização geográfica
- Trending topics
- Bloqueio de usuários
- Múltiplos idiomas além do português
- Chamadas de vídeo/áudio entre usuários
- Stickers e GIFs em mensagens
- Status online/offline
- Arquivamento de conversas
- Edição de Reels após publicação
- Filtros e efeitos avançados para Reels
- Dueto e remix de Reels
- Música de fundo em Reels
- Agendamento de publicações
- Rascunhos de publicações
- Edição de publicações após publicação
- Menções em comentários
- Notificações push nativas
- Backup automático de dados
- Exportação de dados do usuário
- Monetização
- Publicidade
- Funcionalidades premium pagas
- API pública para programadores (visão futura)
- Encriptação de mensagens (estrutura de segurança existe, mas encriptação end-to-end não implementada)
- Processamento completo de denúncias (interface existe, mas fluxo de revisão manual não implementado)
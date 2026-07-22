/**
 * Espaço reservado para o selo "by Medo" no rodapé da pré-visualização.
 * O selo é um elemento da plataforma Medo renderizado FORA do app
 * (na camada iframe do browser), pelo que não pode ser reposicionado
 * pelo código da aplicação. Este valor adiciona uma folga segura nos
 * elementos posicionados absolutamente na parte inferior de cada ecrã,
 * garantindo que nenhum botão, campo ou conteúdo importante fique
 * tapado pelo selo durante os testes.
 *
 * Valor: 40 px — altura típica do selo "by Medo" na pré-visualização.
 * Em produção (sem o painel Medo) este espaço extra é imperceptível
 * pois fica abaixo do safe-area inset nativo do dispositivo.
 */
export const MEDO_BADGE_CLEARANCE = 40;

export const KICK_TEMPLATES = [
    {
        id: 'inactif',
        label: 'Inactivité prolongée',
        title: 'Information concernant ta place dans la guilde',
        body: `Salut {member},

Après plusieurs jours d'inactivité en CR/GvG sans retour, nous devons libérer une place.
Si tu souhaites revenir plus tard, tu seras le bienvenu si des slots sont ouverts (DM Nuka si besoin d'informations supplémentaires).

{note}

Merci de ta compréhension et bonne continuation à toi.`
    },
    {
        id: 'comportement',
        label: 'Comportement / respect des règles',
        title: 'À propos du respect des règles',
        body: `Salut {member},

Suite à plusieurs rappels sur le respect des règles (chat/coordination), nous devons te retirer de la guilde.
Nous restons disponibles en MP pour en parler (DM Nuka si besoin d'informations supplémentaires).

{note}

Bonne continuation à toi.`
    },
    {
        id: 'performance',
        label: 'Performance / engagement',
        title: 'Ajustements de roster',
        body: `Salut {member},

Nous ajustons notre roster et, au regard des performances actuelles, nous ne pouvons pas te garder pour l’instant.
Merci pour ta participation jusqu’ici (DM Nuka si besoin d'informations supplémentaires).

{note}

Bonne continuation à toi !`
    },
];

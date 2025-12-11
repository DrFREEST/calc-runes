const d = require('./runes-parsed.json');

const names = [
    // 사용자 언급 추가 룬들
    '비정한 승부사',
    '붉은 맹약',
    '원소술사',
    '극야',
    '횃불',
    '쇄빙'
];

names.forEach(n => {
    const r = d.runes.find(x => x.name === n);
    if (r) {
        console.log('\n=== ' + n + ' ===');
        console.log('rawDescription:', r.rawDescription);
        console.log('classRestriction:', r.classRestriction);
        console.log('cooldown:', r.cooldown);
        console.log('effects:', JSON.stringify(r.effects, null, 2));
        console.log('demerits:', JSON.stringify(r.demerits, null, 2));
    } else {
        console.log('\n=== ' + n + ' === NOT FOUND');
    }
});


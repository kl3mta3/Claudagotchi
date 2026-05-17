export function TokenDisplay({ tokens, intelligence }) {
  return (
    <div style={S.wrap}>
      <span style={S.tokens} title="Tokens">🪙 {tokens ?? 0}</span>
      <span style={S.intel} title="Intelligence (grows forever)">INT&nbsp;<b style={S.intelN}>{Math.floor(intelligence ?? 0)}</b></span>
    </div>
  );
}

const S = {
  wrap:   { display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#bbb', fontFamily: 'Consolas, monospace' },
  tokens: { color: '#ffd166' },
  intel:  { color: '#888' },
  intelN: { color: '#9ad' },
};

export function maskNickname(nickname) {
  if (!nickname || nickname.length === 0) return '***';
  return nickname.charAt(0) + '***';
}

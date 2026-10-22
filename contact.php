<?php
// 問い合わせフォームの送信先（index.html の contactForm から POST される）
// 送信先アドレスはここだけで管理する
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const TO      = 'info@yellow.technology';
const SUBJECT = '[yellow.technology] お問い合わせ';

function out(bool $ok, string $msg = ''): void {
  echo json_encode(['ok' => $ok, 'message' => $msg], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); out(false, 'method'); }

// ハニーポット（人間には見えない欄に入力があればボット扱い。成功を装って捨てる）
if (!empty($_POST['website'])) out(true);

$f = static function (string $k, int $max): string {
  $v = isset($_POST[$k]) ? trim((string)$_POST[$k]) : '';
  $v = str_replace(["\r", "\0"], '', $v);
  return mb_substr($v, 0, $max);
};
$name    = $f('name', 200);
$org     = $f('org', 200);
$email   = $f('email', 200);
$topic   = $f('topic', 100);
$message = $f('message', 10000);
$lang    = $f('lang', 5);

if ($name === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400); out(false, 'invalid');
}
// ヘッダインジェクション対策（改行を含む値は拒否）
foreach ([$name, $org, $email, $topic] as $v) {
  if (preg_match('/[\r\n]/', $v)) { http_response_code(400); out(false, 'invalid'); }
}

$body = implode("\n", [
  'ウェブサイトのフォームからお問い合わせがありました。',
  '',
  '氏名: '     . $name,
  '所属: '     . ($org !== '' ? $org : '-'),
  'メール: '   . $email,
  '件名: '     . ($topic !== '' ? $topic : '-'),
  '言語: '     . ($lang !== '' ? $lang : '-'),
  '送信日時: ' . date('Y-m-d H:i:s T'),
  'IP: '       . ($_SERVER['REMOTE_ADDR'] ?? '-'),
  '',
  '----- 本文 -----',
  $message,
]);

mb_language('Japanese');
mb_internal_encoding('UTF-8');
$host    = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['SERVER_NAME'] ?? 'yellow.technology');
$headers = implode("\r\n", [
  'From: ' . mb_encode_mimeheader('YELLOW Web Form', 'UTF-8') . ' <no-reply@' . $host . '>',
  'Reply-To: ' . $email,
  'X-Mailer: PHP/' . PHP_VERSION,
]);

$sent = @mb_send_mail(TO, SUBJECT . '（' . $name . '）', $body, $headers);
if (!$sent) { http_response_code(500); out(false, 'mail'); }
out(true);

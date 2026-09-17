<?php
/**
 * お問い合わせフォーム送信（Xserver / PHP mail）
 * - フロント（app.js）から JSON で POST される
 * - 管理者宛て通知 + 送信者への自動返信
 */
declare(strict_types=1);

// ===== 設定 =====
const CONTACT_TO        = 'info@compasshouse.jp';        // 受信先
const CONTACT_FROM      = 'info@compasshouse.jp';        // 送信元（Xserver上に存在するメールアドレスにすること）
const CONTACT_FROM_NAME = 'COMPASS HOUSE';
const SITE_NAME         = 'COMPASS HOUSE';
const SITE_TEL          = '0269-67-0224';
const ALLOWED_ORIGINS   = ['https://compasshouse.jp', 'https://www.compasshouse.jp'];

mb_language('Japanese');
mb_internal_encoding('UTF-8');
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $body): void {
  http_response_code($status);
  echo json_encode($body, JSON_UNESCAPED_UNICODE);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  respond(405, ['ok' => false, 'message' => 'Method Not Allowed']);
}

// 同一オリジンからの送信のみ受け付ける（Origin が無い古い環境は Referer で確認）
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$referer = $_SERVER['HTTP_REFERER'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
$selfOrigins = array_merge(ALLOWED_ORIGINS, $host ? ['https://' . $host, 'http://' . $host] : []);
$originOk = false;
foreach ($selfOrigins as $o) {
  if ($origin === $o || ($origin === '' && $referer !== '' && strpos($referer, $o . '/') === 0)) { $originOk = true; break; }
}
if (!$originOk) {
  respond(403, ['ok' => false, 'message' => 'Forbidden']);
}

$raw = file_get_contents('php://input');
$in = json_decode($raw ?: '', true);
if (!is_array($in)) { $in = $_POST; }

$clean = static function ($v, int $max): string {
  $v = is_string($v) ? $v : '';
  $v = trim(str_replace(["\r\n", "\r"], "\n", $v));
  return mb_substr($v, 0, $max);
};
$oneLine = static fn(string $v): string => str_replace(["\n", "\r"], ' ', $v);

$website   = $clean($in['website'] ?? '', 100);        // ハニーポット（人間は空のまま）
$typeLabel = $oneLine($clean($in['typeLabel'] ?? '', 100));
$name      = $oneLine($clean($in['name'] ?? '', 100));
$company   = $oneLine($clean($in['company'] ?? '', 150));
$email     = $oneLine($clean($in['email'] ?? '', 200));
$tel       = $oneLine($clean($in['tel'] ?? '', 40));
$body      = $clean($in['body'] ?? '', 4000);
$lang      = ($in['lang'] ?? 'ja') === 'en' ? 'en' : 'ja';

if ($website !== '') {
  // スパムボットの可能性：成功を装って何もしない
  respond(200, ['ok' => true]);
}

$errors = [];
if ($name === '')  { $errors[] = 'name'; }
if ($body === '')  { $errors[] = 'body'; }
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors[] = 'email'; }
if ($errors) {
  respond(422, ['ok' => false, 'errors' => $errors,
    'message' => $lang === 'en' ? 'Please check the required fields.' : '必須項目をご確認ください。']);
}

$sentAt = date('Y-m-d H:i:s');
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$ua = $oneLine($clean($_SERVER['HTTP_USER_AGENT'] ?? '', 300));

// ===== 管理者宛て =====
$adminSubject = '【' . SITE_NAME . ' お問い合わせ】' . ($typeLabel !== '' ? $typeLabel : 'Webサイトより');
$adminBody = implode("\n", [
  SITE_NAME . ' のWebサイトからお問い合わせがありました。',
  '',
  '■ お問い合わせ種別：' . $typeLabel,
  '■ お名前：' . $name,
  '■ 会社名・団体名：' . $company,
  '■ メールアドレス：' . $email,
  '■ 電話番号：' . $tel,
  '■ 表示言語：' . $lang,
  '',
  '■ お問い合わせ内容：',
  $body,
  '',
  '----------------------------------------',
  '送信日時：' . $sentAt,
  'IP：' . $ip,
  'UA：' . $ua,
]);
$fromHeader = mb_encode_mimeheader(CONTACT_FROM_NAME, 'UTF-8') . ' <' . CONTACT_FROM . '>';
$adminHeaders = implode("\r\n", [
  'From: ' . $fromHeader,
  'Reply-To: ' . $email,
  'X-Mailer: PHP/' . PHP_VERSION,
]);
$okAdmin = mb_send_mail(CONTACT_TO, $adminSubject, $adminBody, $adminHeaders, '-f ' . CONTACT_FROM);

if (!$okAdmin) {
  respond(500, ['ok' => false, 'code' => 'mail_failed',
    'message' => $lang === 'en'
      ? 'Sending failed. Please try again later or call us at ' . SITE_TEL . '.'
      : '送信に失敗しました。時間をおいて再度お試しいただくか、お電話（' . SITE_TEL . '）にてご連絡ください。']);
}

// ===== 送信者への自動返信 =====
if ($lang === 'en') {
  $userSubject = '[' . SITE_NAME . '] We have received your inquiry';
  $userBody = implode("\n", [
    $name . ',',
    '',
    'Thank you for contacting ' . SITE_NAME . '. We have received your inquiry and will get back to you shortly.',
    '',
    '----------------------------------------',
    'Type: ' . $typeLabel,
    'Name: ' . $name,
    'Company: ' . $company,
    'Email: ' . $email,
    'Tel: ' . $tel,
    '',
    'Message:',
    $body,
    '----------------------------------------',
    '',
    SITE_NAME . ' / Dream Ship CO., Ltd.',
    'TEL ' . SITE_TEL,
    'https://compasshouse.jp/',
  ]);
} else {
  $userSubject = '【' . SITE_NAME . '】お問い合わせを受け付けました';
  $userBody = implode("\n", [
    $name . ' 様',
    '',
    'この度は ' . SITE_NAME . ' へお問い合わせいただき、誠にありがとうございます。',
    '以下の内容でお問い合わせを受け付けました。担当者より折り返しご連絡いたします。',
    '',
    '----------------------------------------',
    'お問い合わせ種別：' . $typeLabel,
    'お名前：' . $name,
    '会社名・団体名：' . $company,
    'メールアドレス：' . $email,
    '電話番号：' . $tel,
    '',
    'お問い合わせ内容：',
    $body,
    '----------------------------------------',
    '',
    '※ このメールは自動送信です。お心当たりがない場合は破棄してください。',
    '',
    SITE_NAME . ' / 株式会社ドリームシップ',
    'TEL ' . SITE_TEL,
    'https://compasshouse.jp/',
  ]);
}
$userHeaders = implode("\r\n", [
  'From: ' . $fromHeader,
  'Reply-To: ' . CONTACT_TO,
  'X-Mailer: PHP/' . PHP_VERSION,
]);
@mb_send_mail($email, $userSubject, $userBody, $userHeaders, '-f ' . CONTACT_FROM);

respond(200, ['ok' => true]);

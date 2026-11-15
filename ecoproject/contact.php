<?php
/**
 * お問い合わせフォーム送信処理（PHP 7.4+ / mbstring）
 *
 * index.html のフォームから POST を受け取り、$CONFIG['to'] 宛にメールを送ります。
 * - fetch（JavaScript）からの送信には JSON で応答
 * - JavaScript 無効時は index.html?sent=1|0#contact にリダイレクト
 */

declare(strict_types=1);

$CONFIG = [
    // 転送先（お問い合わせの受信アドレス）
    'to'      => 'ajisawa@e-project.jpn.com',
    // 送信元。公開サーバーのドメインに属するアドレスにしてください（迷惑メール判定を避けるため）。
    // 空のままなら noreply@{このサイトのホスト名} を使います。
    'from'    => '',
    'subject' => '【ホームページ】お問い合わせがありました',
    // 同一セッションからの連続送信を抑止する間隔（秒）
    'throttle_seconds' => 30,
];

mb_language('Japanese');
mb_internal_encoding('UTF-8');

$isAjax = ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'fetch'
    || strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;

function respond(bool $ok, string $message, int $status, bool $isAjax): void
{
    if ($isAjax) {
        http_response_code($status);
        header('Content-Type: application/json; charset=UTF-8');
        header('Cache-Control: no-store');
        echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    } else {
        header('Location: index.html?sent=' . ($ok ? '1' : '0') . '#contact', true, 303);
    }
    exit;
}

/** 1行項目用：制御文字・改行を除去して長さを制限（メールヘッダインジェクション対策を兼ねる） */
function line(string $key, int $max): string
{
    $v = (string)($_POST[$key] ?? '');
    $v = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(false, '不正なリクエストです。', 405, $isAjax);
}

// ハニーポット：人には見えない項目が埋まっていたらボットとみなし、成功を装って破棄
if (trim((string)($_POST['website'] ?? '')) !== '') {
    respond(true, '', 200, $isAjax);
}

$type    = line('type', 40);
$company = line('company', 100);
$name    = line('name', 60);
$email   = line('email', 120);
$tel     = line('tel', 20);
$message = (string)($_POST['message'] ?? '');
$message = str_replace(["\r\n", "\r"], "\n", $message);
$message = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', $message) ?? '';
$message = mb_substr(trim($message), 0, 3000);
$agree   = (string)($_POST['agree'] ?? '') === '1';

if ($name === '' || $message === '' || !$agree || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, '入力内容をご確認ください。', 422, $isAjax);
}

session_start();
$now = time();
if (isset($_SESSION['contact_sent_at']) && $now - (int)$_SESSION['contact_sent_at'] < $CONFIG['throttle_seconds']) {
    respond(false, '続けて送信することはできません。しばらくしてから再度お試しください。', 429, $isAjax);
}

$host = preg_replace('/[^a-z0-9.\-]/i', '', (string)($_SERVER['SERVER_NAME'] ?? 'localhost'));
$from = $CONFIG['from'] !== '' ? $CONFIG['from'] : 'noreply@' . $host;

$body = implode("\n", [
    'ホームページのお問い合わせフォームから、以下の内容が送信されました。',
    '',
    '■ お問い合わせ種別： ' . ($type !== '' ? $type : '（未選択）'),
    '■ 会社名・管理組合名： ' . ($company !== '' ? $company : '（未入力）'),
    '■ お名前： ' . $name,
    '■ メールアドレス： ' . $email,
    '■ 電話番号： ' . ($tel !== '' ? $tel : '（未入力）'),
    '',
    '■ お問い合わせ内容',
    $message,
    '',
    '----------------------------------------',
    '送信日時： ' . date('Y-m-d H:i:s'),
    '※ このメールに返信すると、お客様（' . $email . '）宛に届きます。',
]);

$headers = implode("\r\n", [
    'From: ' . mb_encode_mimeheader('株式会社エコプロジェクト ホームページ') . ' <' . $from . '>',
    'Reply-To: ' . $email,
]);

$sent = mb_send_mail($CONFIG['to'], $CONFIG['subject'], $body, $headers, '-f' . $from);

if (!$sent) {
    respond(false, '送信できませんでした。お手数ですが、お電話にてお問い合わせください。', 500, $isAjax);
}

$_SESSION['contact_sent_at'] = $now;
respond(true, '', 200, $isAjax);

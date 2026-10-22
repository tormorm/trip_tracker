<?php
// Wishlist pins API — GET list · POST create · DELETE ?id=&addedBy= (own pins only).
// Authentication is Plesk's password-protected directory (HTTP basic auth) in
// front of the whole site; this file only enforces same-origin and validates input.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const LIMITS = ['name' => 80, 'note' => 500, 'addedBy' => 40];
const MAX_BODY = 4096;

function out(int $status, $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $error): void
{
    out($status, ['error' => $error]);
}

// ---------- same-origin only ----------
$host = $_SERVER['HTTP_HOST'] ?? '';
$origin = $_SERVER['HTTP_ORIGIN'] ?? null;
if ($origin !== null && parse_url($origin, PHP_URL_HOST) !== parse_url('//' . $host, PHP_URL_HOST)) {
    fail(403, 'cross-origin');
}
$site = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? null;
if ($site !== null && !in_array($site, ['same-origin', 'none'], true)) {
    fail(403, 'cross-site');
}

// ---------- database ----------
function db(): PDO
{
    $config = require __DIR__ . '/pins.config.php';
    if (!extension_loaded('pdo_sqlite')) {
        fail(500, 'pdo_sqlite is not enabled (see DEPLOY.md)');
    }
    try {
        $pdo = new PDO('sqlite:' . $config['db'], null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $e) {
        error_log('pins.php: cannot open database: ' . $e->getMessage());
        fail(500, 'database unavailable');
    }
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 3000');
    $pdo->exec('CREATE TABLE IF NOT EXISTS pins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        note TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        added_by TEXT NOT NULL,
        created_at TEXT NOT NULL
    )');
    $GLOBALS['max_pins'] = (int)($config['max_pins'] ?? 2000);
    return $pdo;
}

function row(array $r): array
{
    return [
        'id' => $r['id'],
        'name' => $r['name'],
        'note' => $r['note'],
        'lat' => (float)$r['lat'],
        'lng' => (float)$r['lng'],
        'addedBy' => $r['added_by'],
        'createdAt' => $r['created_at'],
    ];
}

/** Trimmed UTF-8 text without control characters, or null if invalid/too long. */
function text($v, int $max, bool $required): ?string
{
    if ($v === null || $v === '') {
        return $required ? null : '';
    }
    if (!is_string($v) || !preg_match('//u', $v)) {
        return null;
    }
    $v = trim(preg_replace('/[\x{0000}-\x{0008}\x{000B}-\x{001F}\x{007F}]/u', '', $v));
    $len = function_exists('mb_strlen') ? mb_strlen($v, 'UTF-8') : preg_match_all('/./us', $v);
    if (($required && $len === 0) || $len > $max) {
        return null;
    }
    return $v;
}

function isId($v): bool
{
    return is_string($v) && preg_match('/^[A-Za-z0-9-]{8,64}$/', $v) === 1;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $rows = db()->query('SELECT * FROM pins ORDER BY created_at DESC')->fetchAll();
    out(200, ['pins' => array_map('row', $rows)]);
}

if ($method === 'POST') {
    // JSON only: plain HTML forms can't send this, which blocks simple cross-site posts.
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        fail(415, 'expected application/json');
    }
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
    if ($raw === false || strlen($raw) > MAX_BODY) {
        fail(413, 'body too large');
    }
    $in = json_decode($raw, true);
    if (!is_array($in)) {
        fail(400, 'invalid JSON');
    }
    $id = $in['id'] ?? null;
    $name = text($in['name'] ?? null, LIMITS['name'], true);
    $note = text($in['note'] ?? null, LIMITS['note'], false);
    $by = text($in['addedBy'] ?? null, LIMITS['addedBy'], true);
    $lat = $in['lat'] ?? null;
    $lng = $in['lng'] ?? null;
    $errors = [];
    if (!isId($id)) $errors[] = 'id';
    if ($name === null) $errors[] = 'name';
    if ($note === null) $errors[] = 'note';
    if ($by === null) $errors[] = 'addedBy';
    if (!is_int($lat) && !is_float($lat) || $lat < -90 || $lat > 90) $errors[] = 'lat';
    if (!is_int($lng) && !is_float($lng) || $lng < -180 || $lng > 180) $errors[] = 'lng';
    if ($errors) {
        fail(422, 'invalid: ' . implode(', ', $errors));
    }

    $pdo = db();
    // Queued offline pins may be sent twice; the client-made id makes that harmless.
    $existing = $pdo->prepare('SELECT * FROM pins WHERE id = ?');
    $existing->execute([$id]);
    if ($r = $existing->fetch()) {
        out(200, ['pin' => row($r)]);
    }
    if ((int)$pdo->query('SELECT COUNT(*) FROM pins')->fetchColumn() >= $GLOBALS['max_pins']) {
        fail(507, 'pin limit reached');
    }
    $createdAt = gmdate('Y-m-d\TH:i:s\Z');
    $ins = $pdo->prepare('INSERT INTO pins (id, name, note, lat, lng, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $ins->execute([$id, $name, $note === '' ? null : $note, round((float)$lat, 6), round((float)$lng, 6), $by, $createdAt]);
    out(201, ['pin' => row(['id' => $id, 'name' => $name, 'note' => $note === '' ? null : $note, 'lat' => $lat, 'lng' => $lng, 'added_by' => $by, 'created_at' => $createdAt])]);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    $by = text($_GET['addedBy'] ?? null, LIMITS['addedBy'], true);
    if (!isId($id) || $by === null) {
        fail(422, 'invalid: id, addedBy');
    }
    $del = db()->prepare('DELETE FROM pins WHERE id = ? AND added_by = ?');
    $del->execute([$id, $by]);
    if ($del->rowCount() === 0) {
        fail(404, 'not found or not yours');
    }
    out(200, ['deleted' => $id]);
}

header('Allow: GET, POST, DELETE');
fail(405, 'method not allowed');

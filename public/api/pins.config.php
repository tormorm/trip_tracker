<?php
// Where the wishlist database lives. Must be OUTSIDE the web root (httpdocs),
// so the file can never be downloaded. Plesk creates /var/www/vhosts/<domain>/private
// for every subscription; with this site in httpdocs/, the path below points there.
// The folder must be writable by the PHP user (see DEPLOY.md).
return [
    'db' => __DIR__ . '/../../private/pins.sqlite',
    // Safety cap so a runaway client can't fill the disk.
    'max_pins' => 2000,
];

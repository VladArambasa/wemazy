<?php
/*
 * Wemazy - settings of the server part.
 * Wemazy - setările părții de server.
 */
return [
    // Empty: Wemazy works only on the computer it runs on (http://localhost).
    // To use it from other computers (a school server, a web host), write a password here.
    // You can also write a hash made with password_hash() instead of the password itself.
    //
    // Gol: Wemazy merge doar pe calculatorul pe care rulează (http://localhost).
    // Ca să-l folosești de pe alte calculatoare (serverul școlii, o găzduire), scrie aici o parolă.
    'password' => '',

    // Where projects are kept, and where sites started with "On PHP" are written.
    // Unde sunt păstrate proiectele și unde sunt scrise site-urile pornite cu „Pe PHP”.
    'data_dir' => dirname(__DIR__) . '/data',
    'sites_dir' => dirname(__DIR__) . '/sites',

    // The biggest project the server accepts, in MB (pictures included).
    // Cel mai mare proiect primit de server, în MB (cu tot cu imagini).
    'max_mb' => 64,
];

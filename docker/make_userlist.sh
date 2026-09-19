#!/bin/sh
# Generate the pgbouncer userlist from the same credentials that provisioned
# postgres (docker/init.sh), so the pooler's passwords always match the
# server-side roles.
#
# Postgres 16 stores SCRAM-SHA-256 verifiers (default password_encryption),
# so pgbouncer must use auth_type = scram-sha-256. With that auth type the
# userlist may store plaintext passwords - pgbouncer performs the SCRAM
# handshake for both the client and the server legs from the plaintext.
set -e

APP_NAME="${PGBOUNCER_APP_NAME:-prime_app}"
ADMIN_NAME="${PGBOUNCER_ADMIN_NAME:-prime_user}"
APP_PASSWORD="${PGBOUNCER_APP_PASSWORD:-prime_app_password}"
ADMIN_PASSWORD="${PGBOUNCER_ADMIN_PASSWORD:-prime_admin_password}"

: > /etc/pgbouncer/userlist.txt
printf '"%s" "%s"\n' "$APP_NAME" "$APP_PASSWORD"       >> /etc/pgbouncer/userlist.txt
printf '"%s" "%s"\n' "$ADMIN_NAME" "$ADMIN_PASSWORD"   >> /etc/pgbouncer/userlist.txt

chown postgres:postgres /etc/pgbouncer/userlist.txt
chmod 600 /etc/pgbouncer/userlist.txt
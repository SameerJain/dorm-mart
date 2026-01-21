# phpMyAdmin for Railway

To deploy phpMyAdmin on Railway:

1. Create a new service in your Railway project
2. Connect it to this directory (or create from Dockerfile)
3. Set these environment variables:
   - `PMA_HOST` = Your MySQL service's internal hostname (usually `mysql` or check Railway's service name)
   - `PMA_PORT` = `3306`
   - `PMA_USER` = Your MySQL username
   - `PMA_PASSWORD` = Your MySQL password
   - `PMA_ARBITRARY` = `1` (allows connecting to any MySQL server)

4. Railway will auto-detect the Dockerfile and deploy phpMyAdmin
5. Access it at your Railway URL

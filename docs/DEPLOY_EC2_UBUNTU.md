# Despliegue En EC2 Ubuntu

Esta guía deja `PageSaleySpa` corriendo en una instancia Ubuntu con `pm2` y `nginx`.

## 1. Crear la instancia

En AWS EC2:

1. Crea una instancia Ubuntu 22.04 o 24.04.
2. Tipo recomendado inicial: `t3.small` o `t3.medium`.
3. Abre estos puertos en el Security Group:
   - `22` SSH
   - `80` HTTP
   - `443` HTTPS
4. Descarga tu llave `.pem`.

## 2. Conectarte por SSH

Desde tu equipo:

```bash
ssh -i tu-llave.pem ubuntu@TU_IP_PUBLICA
```

## 3. Actualizar paquetes

```bash
sudo apt update && sudo apt upgrade -y
```

## 4. Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 5. Instalar Git, Nginx y PM2

```bash
sudo apt install -y git nginx
sudo npm install -g pm2
```

## 6. Instalar MySQL

Si vas a usar MySQL en la misma instancia:

```bash
sudo apt install -y mysql-server
sudo mysql_secure_installation
```

Crear base de datos:

```sql
CREATE DATABASE my_database;
```

Si usarás una base externa, solo guarda sus credenciales para el `.env`.

## 7. Clonar el proyecto

```bash
cd /var/www
sudo mkdir -p saleyspa
sudo chown -R ubuntu:ubuntu /var/www/saleyspa
cd /var/www/saleyspa
git clone https://github.com/StreamingBox/PageSaleySpa.git .
```

## 8. Instalar dependencias

```bash
npm install
```

## 9. Crear el archivo .env

```bash
nano .env
```

Ejemplo:

```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=my_database
SESSION_SECRET=un_valor_largo_y_seguro
HASH_SECRET=otro_valor_largo_y_seguro

APPOINTMENTS_BUSINESS_NAME=SaleySpa
APPOINTMENTS_BUSINESS_ADDRESS=Calle 123 #45-67, Bogota, Colombia
APPOINTMENTS_CALENDAR_EMAIL=payss24@gmail.com

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://developers.google.com/oauthplayground
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=primary
NODE_ENV=production
PORT=3000
```

## 10. Compilar el frontend

```bash
npm run build
```

## 11. Probar el arranque

```bash
node app.js
```

Si abre en `http://TU_IP:3000`, detén el proceso con `Ctrl + C`.

## 12. Levantar con PM2

```bash
pm2 start app.js --name saleyspa
pm2 save
pm2 startup
```

Ejecuta el comando extra que te devuelva `pm2 startup`.

## 13. Configurar Nginx

Crear config:

```bash
sudo nano /etc/nginx/sites-available/saleyspa
```

Contenido:

```nginx
server {
    listen 80;
    server_name TU_DOMINIO_O_IP;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activar sitio:

```bash
sudo ln -s /etc/nginx/sites-available/saleyspa /etc/nginx/sites-enabled/saleyspa
sudo nginx -t
sudo systemctl restart nginx
```

## 14. HTTPS con Certbot

Si ya tienes dominio apuntando a la EC2:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

## 15. Actualizar la app después

```bash
cd /var/www/saleyspa
git pull origin main
npm install
npm run build
pm2 restart saleyspa
```

## 16. Comandos útiles

Estado:

```bash
pm2 status
pm2 logs saleyspa
sudo systemctl status nginx
```

Reinicio:

```bash
pm2 restart saleyspa
sudo systemctl restart nginx
```

## 17. Recomendaciones

- No subas `.env` al repositorio.
- Usa un usuario MySQL dedicado para producción.
- Si vas a escalar, mueve MySQL a RDS.
- Haz backups de base de datos y de `.env`.
- Cambia secretos por valores largos y únicos.

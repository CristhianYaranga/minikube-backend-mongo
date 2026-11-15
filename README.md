# Despliegue de Arquitectura de Dos Capas (Backend API + MongoDB) en Kubernetes con Minikube

## Descripción del Proyecto

Este proyecto implementa y valida una arquitectura de dos capas contenerizada sobre **Kubernetes (Minikube)** dentro del namespace `practica-s08`:

1. **Capa de Datos (MongoDB 6):** Desplegada mediante un `Deployment` y expuesta únicamente de forma interna al clúster a través de un `Service` tipo **ClusterIP** (`mongo-service:27017`).
2. **Capa de Aplicación (Backend Node.js + Express):** API REST ligera que lee su configuración de red/aplicación desde un **ConfigMap** (`app-configmap`) y sus credenciales de autenticación desde un **Secret** (`db-secret`) inyectados mediante `envFrom`. Se expone hacia el exterior del clúster a través de un `Service` tipo **NodePort** (`backend-service`, puerto de nodo `30080`).

---

## Diagrama de Arquitectura

```text
[ Cliente (Navegador / curl) ]
              │
              ▼  HTTP (Puerto 30080)
[ Service NodePort: backend-service (30080 -> 3000) ]
              │
              ▼
[ Pod Backend (Node.js + Express :3000) ]  ◄── envFrom ── [ ConfigMap (app-configmap) + Secret (db-secret) ]
              │
              ▼  TCP / DNS interno (mongo-service:27017)
[ Service ClusterIP: mongo-service (27017 -> 27017) ]
              │
              ▼
[ Pod MongoDB (mongo:6 :27017) ]           ◄── secretKeyRef ── [ Secret (db-secret) ]
```

Flujo lineal resumido:
`Cliente → NodePort (30080) → Backend (Express :3000) → ClusterIP (mongo-service:27017) → MongoDB (:27017)`

---

## ¿Por qué se usan ConfigMap y Secret?

En metodologías Cloud-Native y **12-Factor App**, la configuración debe estar estrictamente separada del código fuente y de la imagen del contenedor:

- **ConfigMap (`app-configmap`):** Permite desacoplar parámetros de configuración no sensibles (`DB_HOST`, `DB_NAME`, `APP_PORT`) de la imagen Docker. Así, la misma imagen `backend-s08:1.0` puede ejecutarse en distintos entornos (desarrollo, pruebas, producción) cambiando únicamente el manifiesto del ConfigMap sin reconstruir la imagen.
- **Secret (`db-secret`):** Diseñado para gestionar datos sensibles como credenciales (`DB_USER`, `DB_PASS`) evitando escribirlos en texto plano dentro de los `Deployments` o en el código fuente.
- **Nota importante sobre Base64:** Los valores en la sección `data` de un `Secret` de Kubernetes se almacenan en **Base64** (`YWRtaW4=`, `YWRtaW4xMjM=`). **Base64 es un esquema de codificación, NO de cifrado.** Cualquier persona con permisos de lectura sobre el manifiesto o el objeto Secret puede decodificarlo trivialmente con `base64 -d`. Para seguridad real en producción se debe habilitar *Encryption at Rest* en `etcd`, aplicar controles estrictos de RBAC y/o emplear gestores externos como HashiCorp Vault o Sealed Secrets.

---

## Estructura del Repositorio

```text
/
├── k8s/
│   ├── 01-app-configmap.yaml    # Variables no sensibles (DB_HOST, DB_NAME, APP_PORT)
│   ├── 02-db-secret.yaml        # Credenciales en Base64 (DB_USER, DB_PASS)
│   ├── 03-mongo-stack.yaml      # Deployment + Service ClusterIP para MongoDB
│   └── 04-backend-stack.yaml    # Deployment + Service NodePort (30080) para el Backend
├── src/
│   ├── Dockerfile               # Imagen basada en node:20-alpine
│   ├── package.json             # Dependencias (express, mongodb)
│   └── index.js                 # API Express que valida la conexión con ping a MongoDB
├── evidencias/                  # Salidas de los comandos de verificación en texto plano
└── README.md                    # Documentación del proyecto
```

---

## Pasos de Despliegue

### 1. Verificar e iniciar Minikube
```bash
minikube start --driver=docker --container-runtime=docker
```

### 2. Apuntar la terminal al daemon Docker de Minikube y construir la imagen
En **PowerShell**:
```powershell
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
docker build -t backend-s08:1.0 ./src
```
*(En Bash/Linux/macOS: `eval $(minikube docker-env)` seguido de `docker build -t backend-s08:1.0 ./src`)*

### 3. Crear el namespace y desplegar los manifiestos
```bash
kubectl create namespace practica-s08
kubectl apply -f k8s/
```

### 4. Verificar que los Pods estén en estado `Running`
```bash
kubectl get pods -n practica-s08 -w
```

---

## Comandos de Validación

1. **Listar todos los recursos desplegados en el namespace:**
   ```bash
   kubectl get pods,svc,configmaps,secrets -n practica-s08
   ```

2. **Verificar la inyección de variables de entorno en el Pod del Backend:**
   ```bash
   kubectl exec -n practica-s08 <nombre-pod-backend> -- env | grep -E "DB_HOST|DB_NAME|APP_PORT|DB_USER|DB_PASS"
   ```

3. **Probar el endpoint expuesto por el Service NodePort:**
   ```bash
   minikube service backend-service -n practica-s08 --url
   curl <URL_GENERADA>
   ```
   Respuesta esperada:
   ```json
   {
     "status": "OK",
     "mongoStatus": "Conectado exitosamente a MongoDB",
     "database": "practica_db",
     "host": "mongo-service"
   }
   ```

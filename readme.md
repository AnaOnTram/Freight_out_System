# Warehouse System
## System Structure
The system contains three levels of services: 1. The database to support the operation; 2. The backend javascript to handle API calls; 3. The front-end html file to enable GUI.
## Database Structure
To login into the database. First open a command prompt.
```shell
#Visit the directory where you install the MySQL
cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"
mysql -u root -p
#enter your passwords
```
```sql
SHOW DATABASEs;
```
You will see the output:
```sql
+-------------------------+
| Database                |
+-------------------------+
| warehouse_picker_system |
+-------------------------+
1 rows in set (0.00 sec)
```
Use the designed database:
```sql
USE warehouse_picker_system
```
```sql
SHOW TABLES;
```
You will see all tables:
```sql
+-----------------------------------+
| Tables_in_warehouse_picker_system |
+-----------------------------------+
| forwarder_selection               |
| forwarders                        |
| pickers                           |
| shipping_orders                   |
| system_settings                   |
| verification_logs                 |
+-----------------------------------+
6 rows in set (0.00 sec)
```
Detailed Table Description
```sql
mysql> DESCRIBE forwarder_selection;
+-----------------+--------------+------+-----+---------+----------------+
| Field           | Type         | Null | Key | Default | Extra          |
+-----------------+--------------+------+-----+---------+----------------+
| id              | int unsigned | NO   | PRI | NULL    | auto_increment |
| destination     | varchar(10)  | NO   |     | NULL    |                |
| customer        | varchar(100) | NO   |     | NULL    |                |
| priority        | char(1)      | NO   |     | NULL    |                |
| dg              | char(1)      | NO   |     | NULL    |                |
| prepayment_term | varchar(10)  | NO   |     | NULL    |                |
| shipping_type   | varchar(30)  | NO   |     | NULL    |                |
| carrier_cd      | varchar(20)  | NO   |     | NULL    |                |
| forwarder       | varchar(100) | NO   |     | NULL    |                |
| remark          | text         | YES  |     | NULL    |                |
| hyperlink       | varchar(255) | YES  |     | NULL    |                |
+-----------------+--------------+------+-----+---------+----------------+
11 rows in set (0.00 sec)

mysql> DESCRIBE forwarders;
+-------------------+---------------------------+------+-----+-------------------+-------------------+
| Field             | Type                      | Null | Key | Default           | Extra             |
+-------------------+---------------------------+------+-----+-------------------+-------------------+
| forwarder_id      | int                       | NO   | PRI | NULL              | auto_increment    |
| forwarder_name    | varchar(255)              | NO   | UNI | NULL              |                   |
| registration_date | timestamp                 | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| contact_email     | varchar(255)              | YES  |     | NULL              |                   |
| contact_phone     | varchar(50)               | YES  |     | NULL              |                   |
| status            | enum('active','inactive') | YES  |     | active            |                   |
+-------------------+---------------------------+------+-----+-------------------+-------------------+
6 rows in set (0.00 sec)

mysql> Describe pickers;
+-------------------+-----------------------------------------+------+-----+-------------------+-------------------+
| Field             | Type                                    | Null | Key | Default           | Extra             |
+-------------------+-----------------------------------------+------+-----+-------------------+-------------------+
| picker_id         | int                                     | NO   | PRI | NULL              | auto_increment    |
| forwarder_name    | varchar(255)                            | NO   | MUL | NULL              |                   |
| pi_number         | varchar(100)                            | NO   | MUL | NULL              |                   |
| picker_name       | varchar(255)                            | NO   |     | NULL              |                   |
| hkid_number       | varchar(20)                             | NO   |     | NULL              |                   |
| picker_contact    | varchar(50)                             | NO   |     | NULL              |                   |
| car_plate_number  | varchar(20)                             | YES  |     | NULL              |                   |
| id_document_path  | varchar(500)                            | YES  |     | NULL              |                   |
| id_document_name  | varchar(255)                            | YES  |     | NULL              |                   |
| qr_code_id        | varchar(50)                             | NO   | UNI | NULL              |                   |
| qr_code_path      | varchar(500)                            | YES  |     | NULL              |                   |
| registration_time | timestamp                               | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| verification_time | timestamp                               | YES  |     | NULL              |                   |
| status            | enum('registered','verified','expired') | YES  |     | registered        |                   |
+-------------------+-----------------------------------------+------+-----+-------------------+-------------------+
14 rows in set (0.00 sec)

mysql> describe shipping_orders;
+----------------+-----------------------------------------+------+-----+-------------------+-----------------------------------------------+
| Field          | Type                                    | Null | Key | Default           | Extra                                         |
+----------------+-----------------------------------------+------+-----+-------------------+-----------------------------------------------+
| pi_number      | varchar(100)                            | NO   | PRI | NULL              |                                               |
| parts_number   | varchar(100)                            | NO   |     | NULL              |                                               |
| serial_number  | varchar(100)                            | NO   |     | NULL              |                                               |
| weight_kg      | decimal(10,2)                           | NO   |     | NULL              |                                               |
| length_cm      | decimal(8,2)                            | NO   |     | NULL              |                                               |
| width_cm       | decimal(8,2)                            | NO   |     | NULL              |                                               |
| height_cm      | decimal(8,2)                            | NO   |     | NULL              |                                               |
| picking_status | enum('pending','completed','cancelled') | YES  | MUL | pending           |                                               |
| picking_time   | timestamp                               | YES  |     | NULL              |                                               |
| created_time   | timestamp                               | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED                             |
| updated_time   | timestamp                               | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
+----------------+-----------------------------------------+------+-----+-------------------+-----------------------------------------------+
11 rows in set (0.00 sec)

mysql> describe system_settings;
+---------------+--------------+------+-----+-------------------+-----------------------------------------------+
| Field         | Type         | Null | Key | Default           | Extra                                         |
+---------------+--------------+------+-----+-------------------+-----------------------------------------------+
| setting_key   | varchar(100) | NO   | PRI | NULL              |                                               |
| setting_value | text         | YES  |     | NULL              |                                               |
| description   | text         | YES  |     | NULL              |                                               |
| updated_time  | timestamp    | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
+---------------+--------------+------+-----+-------------------+-----------------------------------------------+
4 rows in set (0.00 sec)

mysql> describe verification_logs;
+---------------------+---------------------------+------+-----+-------------------+-------------------+
| Field               | Type                      | Null | Key | Default           | Extra             |
+---------------------+---------------------------+------+-----+-------------------+-------------------+
| log_id              | int                       | NO   | PRI | NULL              | auto_increment    |
| qr_code_id          | varchar(50)               | NO   | MUL | NULL              |                   |
| pi_number           | varchar(100)              | NO   | MUL | NULL              |                   |
| verification_time   | timestamp                 | YES  | MUL | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| gate_operator       | varchar(255)              | YES  |     | NULL              |                   |
| verification_status | enum('approved','denied') | YES  |     | approved          |                   |
| notes               | text                      | YES  |     | NULL              |                   |
+---------------------+---------------------------+------+-----+-------------------+-------------------+
7 rows in set (0.00 sec)
```

# How to run the services

### Start the MySQL database services
Open a Command Prompt as Admin
```bash
net start mysql80
```
You will see the service start successfully

### Start Node.js services
Open another command prompt
```bash
cd picker-system

npm start
```
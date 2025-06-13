-- MySQL dump 10.13  Distrib 8.0.42, for Linux (x86_64)
--
-- Host: localhost    Database: warehouse_picker_system
-- ------------------------------------------------------
-- Server version	8.0.42-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `warehouse_picker_system`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `warehouse_picker_system` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `warehouse_picker_system`;

--
-- Table structure for table `forwarders`
--

DROP TABLE IF EXISTS `forwarders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `forwarders` (
  `forwarder_id` int NOT NULL AUTO_INCREMENT,
  `forwarder_name` varchar(255) NOT NULL,
  `registration_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `contact_email` varchar(255) DEFAULT NULL,
  `contact_phone` varchar(50) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  PRIMARY KEY (`forwarder_id`),
  UNIQUE KEY `forwarder_name` (`forwarder_name`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `forwarders`
--

LOCK TABLES `forwarders` WRITE;
/*!40000 ALTER TABLE `forwarders` DISABLE KEYS */;
INSERT INTO `forwarders` VALUES (2,'Test Logistics Ltd','2025-06-13 01:25:59',NULL,NULL,'active'),(3,'ABC Logistics','2025-06-13 01:33:08',NULL,NULL,'active'),(4,'Web Test Company','2025-06-13 01:49:09',NULL,NULL,'active'),(5,'CPA Cargo','2025-06-13 02:11:13',NULL,NULL,'active'),(6,'Nippon Cargo','2025-06-13 02:15:59',NULL,NULL,'active'),(7,'Japan Airline','2025-06-13 03:00:52',NULL,NULL,'active'),(8,'ANA The Evil Cat','2025-06-13 03:37:26',NULL,NULL,'active');
/*!40000 ALTER TABLE `forwarders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pickers`
--

DROP TABLE IF EXISTS `pickers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pickers` (
  `picker_id` int NOT NULL AUTO_INCREMENT,
  `forwarder_name` varchar(255) NOT NULL,
  `pi_number` varchar(100) NOT NULL,
  `picker_name` varchar(255) NOT NULL,
  `hkid_number` varchar(20) NOT NULL,
  `picker_contact` varchar(50) NOT NULL,
  `car_plate_number` varchar(20) DEFAULT NULL,
  `id_document_path` varchar(500) DEFAULT NULL,
  `id_document_name` varchar(255) DEFAULT NULL,
  `qr_code_id` varchar(50) NOT NULL,
  `qr_code_path` varchar(500) DEFAULT NULL,
  `registration_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `verification_time` timestamp NULL DEFAULT NULL,
  `status` enum('registered','verified','expired') DEFAULT 'registered',
  PRIMARY KEY (`picker_id`),
  UNIQUE KEY `qr_code_id` (`qr_code_id`),
  KEY `idx_pickers_qr_code` (`qr_code_id`),
  KEY `idx_pickers_pi_number` (`pi_number`),
  KEY `fk_picker_forwarder` (`forwarder_name`),
  CONSTRAINT `fk_picker_forwarder` FOREIGN KEY (`forwarder_name`) REFERENCES `forwarders` (`forwarder_name`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pickers`
--

LOCK TABLES `pickers` WRITE;
/*!40000 ALTER TABLE `pickers` DISABLE KEYS */;
INSERT INTO `pickers` VALUES (4,'Test Logistics Ltd','PI2024TEST001','John Test Doe','A1234567','+852 9123 4567','TEST123',NULL,NULL,'WHMBU4MA66SLOJX','/home/ross/picker-system/qr-codes/WHMBU4MA66SLOJX.png','2025-06-13 01:25:59',NULL,'registered'),(5,'ABC Logistics','PI2024TEST999','Test User','C9876543','+852 1234 5678',NULL,NULL,NULL,'WHMBU4VHHIYHK5L','/home/ross/picker-system/qr-codes/WHMBU4VHHIYHK5L.png','2025-06-13 01:33:08',NULL,'registered'),(6,'Web Test Company','PI2024WEB001','Web Test User','W1234567','+852 5555 1234',NULL,'/home/ross/picker-system/uploads/id-documents/id-document-1749779349317-715219474.png','hkid_sample.png','WHMBU5G2TTG5FJ2','/home/ross/picker-system/qr-codes/WHMBU5G2TTG5FJ2.png','2025-06-13 01:49:09',NULL,'registered'),(7,'CPA Cargo','19970701','Ronald Lam','A123456','12345678',NULL,'/home/ross/picker-system/uploads/id-documents/id-document-1749780673744-513992600.png','hkid_sample.png','WHMBU68GREKUR2J','/home/ross/picker-system/qr-codes/WHMBU68GREKUR2J.png','2025-06-13 02:11:13',NULL,'registered'),(8,'Nippon Cargo','PI2025TEST001','Hirayama','A1234567','12345678','PETHOTEL','/home/ross/picker-system/uploads/id-documents/id-document-1749780959100-165711789.png','hkid_sample.png','WHMBU6EKXRR95X3','/home/ross/picker-system/qr-codes/WHMBU6EKXRR95X3.png','2025-06-13 02:15:59',NULL,'registered'),(9,'Japan Airline','PI2025TEST002','Jack','C9126835','52696909',NULL,'/home/ross/picker-system/uploads/id-documents/id-document-1749783652254-273097816.png','hkid_sample.png','WHMBU80AZR4B049','/home/ross/picker-system/qr-codes/WHMBU80AZR4B049.png','2025-06-13 03:00:52','2025-06-13 03:21:39','verified'),(10,'ANA The Evil Cat','PI2025TEST003','Daisy','A112233','52696909',NULL,'/home/ross/picker-system/uploads/id-documents/id-document-1749785846616-653950497.png','hkid_sample.png','WHMBU9BC69HUAZM','/home/ross/picker-system/qr-codes/WHMBU9BC69HUAZM.png','2025-06-13 03:37:26',NULL,'registered');
/*!40000 ALTER TABLE `pickers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipping_orders`
--

DROP TABLE IF EXISTS `shipping_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipping_orders` (
  `pi_number` varchar(100) NOT NULL,
  `parts_number` varchar(100) NOT NULL,
  `serial_number` varchar(100) NOT NULL,
  `weight_kg` decimal(10,2) NOT NULL,
  `length_cm` decimal(8,2) NOT NULL,
  `width_cm` decimal(8,2) NOT NULL,
  `height_cm` decimal(8,2) NOT NULL,
  `picking_status` enum('pending','completed','cancelled') DEFAULT 'pending',
  `picking_time` timestamp NULL DEFAULT NULL,
  `created_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pi_number`),
  KEY `idx_shipping_status` (`picking_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipping_orders`
--

LOCK TABLES `shipping_orders` WRITE;
/*!40000 ALTER TABLE `shipping_orders` DISABLE KEYS */;
INSERT INTO `shipping_orders` VALUES ('PI2024TEST001','TEST-PART-001','SN123456789',25.50,100.00,50.00,30.00,'pending',NULL,'2025-06-13 01:27:05','2025-06-13 01:27:05'),('PI2025TEST002','ENG-TRE-001','SN1000-97',1000.00,500.00,500.00,500.00,'completed','2025-06-13 03:21:39','2025-06-13 02:59:34','2025-06-13 03:21:39'),('PI2025TEST003','TABBY-FOOD-01','CAT010101',4.50,20.00,15.00,60.00,'pending',NULL,'2025-06-13 03:36:48','2025-06-13 03:36:48');
/*!40000 ALTER TABLE `shipping_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `description` text,
  `updated_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` VALUES ('allowed_file_types','jpg,jpeg,png,pdf','Allowed file types for ID documents','2025-06-12 09:10:46'),('max_file_size_mb','10','Maximum file size for document uploads in MB','2025-06-12 09:10:46'),('qr_expiry_hours','24','Hours after which QR codes expire','2025-06-12 09:10:46');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `verification_logs`
--

DROP TABLE IF EXISTS `verification_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `verification_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `qr_code_id` varchar(50) NOT NULL,
  `pi_number` varchar(100) NOT NULL,
  `verification_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `gate_operator` varchar(255) DEFAULT NULL,
  `verification_status` enum('approved','denied') DEFAULT 'approved',
  `notes` text,
  PRIMARY KEY (`log_id`),
  KEY `qr_code_id` (`qr_code_id`),
  KEY `pi_number` (`pi_number`),
  KEY `idx_verification_time` (`verification_time`),
  CONSTRAINT `verification_logs_ibfk_1` FOREIGN KEY (`qr_code_id`) REFERENCES `pickers` (`qr_code_id`),
  CONSTRAINT `verification_logs_ibfk_2` FOREIGN KEY (`pi_number`) REFERENCES `shipping_orders` (`pi_number`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `verification_logs`
--

LOCK TABLES `verification_logs` WRITE;
/*!40000 ALTER TABLE `verification_logs` DISABLE KEYS */;
INSERT INTO `verification_logs` VALUES (1,'WHMBU80AZR4B049','PI2025TEST002','2025-06-13 03:21:34',NULL,'approved','ok'),(2,'WHMBU80AZR4B049','PI2025TEST002','2025-06-13 03:21:39','Gate Security','approved','Pickup confirmed at gate verification'),(3,'WHMBU9BC69HUAZM','PI2025TEST003','2025-06-13 03:52:55',NULL,'approved','ok'),(4,'WHMBU9BC69HUAZM','PI2025TEST003','2025-06-13 03:56:52',NULL,'approved','ok'),(5,'WHMBU80AZR4B049','PI2025TEST002','2025-06-13 04:08:49',NULL,'approved','ok');
/*!40000 ALTER TABLE `verification_logs` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-06-13 12:28:48

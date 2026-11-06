#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

void setup() {
  Serial.begin(115200);
  Serial.println("NEXUS-SENTINEL terrestre BLE 0xFC45");
  BLEDevice::init("NEXUS-SENTINEL");
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(BLEUUID((uint16_t)0xFC45));
  pService->start();
  BLEAdvertising *pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(BLEUUID((uint16_t)0xFC45));
  pAdv->setScanResponse(true);
  pAdv->start();
  Serial.println("Advertising 0xFC45 ON");
}

void loop() { delay(5000); }

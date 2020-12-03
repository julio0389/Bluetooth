'use strict';

//const bleNusServiceUUID  = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
//const bleNusCharRXUUID   = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
//const bleNusCharTXUUID   = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const MTU = 20;


const bleNusServiceUUID = '0000180a-0000-1000-8000-00805f9b34fb';

const bleNusCharRXUUID  = '00031234-0000-1000-8000-00805f9b0131';

const bleNusCharTXUUID  = '00031234-0000-1000-8000-00805f9b0130';

 




var bleDevice;
var bleServer;
var nusService;
var rxCharacteristic;
var txCharacteristic;

var connected = false;

function connectionToggle() {
    if (connected) {
        disconnect();
    } else {
        connect();
    }
}
function toHex(x){
    let hex="0123456789ABCDEF";
    return x.toString(16);
}
function prepareCmd(msg) {
    let hex="0123456789ABCDEF";
    let cmd = "00"+hex[(msg.length & 0xF0)>>4]+ hex[(msg.length & 0xF)];
    let chk=0x60+cmd.charCodeAt(2)+cmd.charCodeAt(3);;
    //console.log('cmd+l=',cmd);
    for (let i = 0; i < msg.length; i++) {
            let val = msg[i].toUpperCase().charCodeAt(0);
        //    console.log("chk+val:"+toHex(chk)+"+"+toHex(val));
            cmd += msg[i].toUpperCase();
            chk += val;
    }
    console.log('c=',chk);
    chk = chk & 255;
    console.log('c&255=',toHex(chk));
alert('c&255='+toHex(chk));
    let h = hex[(chk & 0xF0)>>4];
    let l = hex[(chk & 0xF)];
    cmd = "\x02"+cmd+h+l+"\x03";
    console.log('cmd+l+c=',cmd);
    return cmd;
}

function sendCmd() {
    if (connected || true) {
         var msg = document.getElementById('cmd').value;
         var cmd = prepareCmd(msg);
         window.term_.io.print('sending:');window.term_.io.println(cmd);
         nusSendString(cmd);
    } else {
        window.term_.io.println('not connected');
    }
    
}


// Sets button to either Connect or Disconnect
function setConnButtonState(enabled) {
    if (enabled) {
        document.getElementById("clientConnectButton").innerHTML = "Disconnect";
    } else {
        document.getElementById("clientConnectButton").innerHTML = "Connect";
    }
}

function connect() {
    if (!navigator.bluetooth) {
        console.log('WebBluetooth API is not available.\r\n' +
                    'Please make sure the Web Bluetooth flag is enabled.');
        window.term_.io.println('WebBluetooth API is not available on your browser.\r\n' +
                    'Please make sure the Web Bluetooth flag is enabled.');
        return;
    }
	const devices = await navigator.bluetooth.getDevices();
    for (const device of devices) {
		window.term_.io.println('\r\n' + device.name + ' Connected.');
		window.term_.io.println('\r\n' + device.uuids + ' Connected.');
    }
    console.log('Requesting Bluetooth Device...');
    navigator.bluetooth.requestDevice({
        //filters: [{services: []}]
        optionalServices: [bleNusServiceUUID],
        acceptAllDevices: true
    })
    .then(device => {
        bleDevice = device; 
        console.log('Found ' + device.name);
        console.log('Connecting to GATT Server...');
        bleDevice.addEventListener('gattserverdisconnected', onDisconnected);
        return device.gatt.connect();
    })
    .then(server => {
        console.log('Locate NUS service');
        return server.getPrimaryService(bleNusServiceUUID);
    }).then(service => {
        nusService = service;
        console.log('Found NUS service: ' + service.uuid);
    })
    .then(() => {
        console.log('Locate RX characteristic');
        return nusService.getCharacteristic(bleNusCharRXUUID);
    })
    .then(characteristic => {
        rxCharacteristic = characteristic;
        console.log('Found RX characteristic');
    })
    .then(() => {
        console.log('Locate TX characteristic');
        return nusService.getCharacteristic(bleNusCharTXUUID);
    })
    .then(characteristic => {
        txCharacteristic = characteristic;
        console.log('Found TX characteristic');
    })
    .then(() => {
        console.log('Enable notifications');
        return txCharacteristic.startNotifications();
    })
    .then(() => {
        console.log('Notifications started');
        txCharacteristic.addEventListener('characteristicvaluechanged',
                                          handleNotifications);
        connected = true;
        window.term_.io.println('\r\n' + bleDevice.name + ' Connected.');
        //nusSendString('\r');
        //nusSendString('+++EXPERT-1');
        //nusSendString('Connection from BLE');
        setConnButtonState(true);
    })
    .catch(error => {
        console.log('' + error);
        window.term_.io.println('' + error);
        if(bleDevice && bleDevice.gatt.connected)
        {
            bleDevice.gatt.disconnect();
        }
    });
}

function disconnect() {
    if (!bleDevice) {
        console.log('No Bluetooth Device connected...');
        return;
    }
    console.log('Disconnecting from Bluetooth Device...');
    if (bleDevice.gatt.connected) {
        bleDevice.gatt.disconnect();
        connected = false;
        setConnButtonState(false);
        console.log('Bluetooth Device connected: ' + bleDevice.gatt.connected);
    } else {
        console.log('> Bluetooth Device is already disconnected');
    }
}

function onDisconnected() {
    connected = false;
    window.term_.io.println('\r\n' + bleDevice.name + ' Disconnected.');
    setConnButtonState(false);
}

function handleNotifications(event) {
    console.log('notification');
    let value = event.target.value;
    // Convert raw data bytes to character values and use these to 
    // construct a string.
    let str = "";
    if (value.getUint8(0)==1){
         window.term_.io.println("rec from device:");
    }
    for (let i = 0; i < value.byteLength; i++) {
        str += String.fromCharCode(value.getUint8(i));
    }
    window.term_.io.print(str);
}

function nusSendString(s) {
    if(bleDevice && bleDevice.gatt.connected) {
        console.log("send: " + s);
        let val_arr = new Uint8Array(s.length)
        for (let i = 0; i < s.length; i++) {
            let val = s[i].charCodeAt(0);
            val_arr[i] = val;
        }
        sendNextChunk(val_arr);
    } else {
        window.term_.io.println('Not connected to a device yet.');
    }
}

function sendNextChunk(a) {
    let chunk = a.slice(0, MTU);
    rxCharacteristic.writeValue(chunk)
      .then(function() {
          if (a.length > MTU) {
              sendNextChunk(a.slice(MTU));
          }
      });
}



function initContent(io) {
    io.println("\r\n\
Welcome to Web Device CLI V0.1.0 (03/19/2019)\r\n\
Copyright (C) 2019  makerdiary.\r\n\
\r\n\
This is a Web Command Line Interface via NUS (Nordic UART Service) using Web Bluetooth.\r\n\
\r\n\
  * Source: https://github.com/makerdiary/web-device-cli\r\n\
  * Live:   https://makerdiary.github.io/web-device-cli\r\n\
");
}

function setupHterm() {
    const term = new hterm.Terminal();

    term.onTerminalReady = function() {
        const io = this.io.push();
        io.onVTKeystroke = (string) => {
            nusSendString(string);
        };
        io.sendString = nusSendString;
        initContent(io);
        this.setCursorVisible(true);
        this.keyboard.characterEncoding = 'raw';
    };
    term.decorate(document.querySelector('#terminal'));
    term.installKeyboard();

    term.contextMenu.setItems([
        ['Terminal Reset', () => {term.reset(); initContent(window.term_.io);}],
        ['Terminal Clear', () => {term.clearHome();}],
        [hterm.ContextMenu.SEPARATOR],
        ['GitHub', function() {
            lib.f.openWindow('https://github.com/makerdiary/web-device-cli', '_blank');
        }],
    ]);

    // Useful for console debugging.
    window.term_ = term;
}

window.onload = function() {
    lib.init(setupHterm);
};
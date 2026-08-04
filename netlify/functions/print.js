const net = require('net');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { printer, port, data } = JSON.parse(event.body);
    
    // Raw TCP printing
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      
      client.connect(port, printer, () => {
        const buffer = Buffer.from(data, 'base64');
        client.write(buffer);
        client.end();
        
        resolve({
          statusCode: 200,
          body: JSON.stringify({ success: true })
        });
      });
      
      client.on('error', (error) => {
        reject({
          statusCode: 500,
          body: JSON.stringify({ error: error.message })
        });
      });
      
      setTimeout(() => {
        client.destroy();
        reject({
          statusCode: 408,
          body: JSON.stringify({ error: 'Connection timeout' })
        });
      }, 5000);
    });
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
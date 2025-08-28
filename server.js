const express = require('express');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const cors = require('cors');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
app.use(cors());
app.use(express.static('public'));

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36';

app.get('/download', async (req, res) => {
  const { url, type, quality } = req.query;

  if (!ytdl.validateURL(url)) {
    return res.status(400).send('Invalid YouTube URL');
  }

  try {
    const info = await ytdl.getInfo(url, {
      requestOptions: {
        headers: {
          'User-Agent': userAgent
        }
      }
    });

    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    const format = type === 'mp3' ? 'mp3' : 'mp4';

    res.header('Content-Disposition', `attachment; filename="${title}.${format}"`);
    res.header('Content-Type', type === 'mp3' ? 'audio/mpeg' : 'video/mp4');

    if (type === 'mp3') {
      const stream = ytdl.downloadFromInfo(info, {
        quality: 'highestaudio',
        filter: 'audioonly',
        requestOptions: {
          headers: {
            'User-Agent': userAgent
          }
        }
      });

      ffmpeg(stream)
        .audioBitrate(128)
        .toFormat('mp3')
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          if (!res.headersSent) {
            res.status(500).send(`Conversion error: ${err.message}`);
          }
        })
        .on('end', () => {
          console.log('Conversion finished');
        })
        .pipe(res, { end: true });
    } else {
      ytdl.downloadFromInfo(info, {
        quality: quality || 'highest',
        filter: 'audioandvideo',
        requestOptions: {
          headers: {
            'User-Agent': userAgent
          }
        }
      }).pipe(res);
    }
  } catch (err) {
    console.error('Download error:', err);
    if (!res.headersSent) {
      res.status(500).send(`Download failed: ${err.message}`);
    }
  }
});

const findAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const server = require('net').createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
};

const startServer = async () => {
  try {
    const port = await findAvailablePort(3000);
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
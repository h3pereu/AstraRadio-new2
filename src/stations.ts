export type Station = {
  id: string;
  name: string;
  streamUrl: string;
  title: string;
  artist: string;
  artwork?: string;
  mount?: string;
  quality: string;
};

export const stations: Station[] = [
  {
    id: 'astra-320',
    name: 'Astra Radio 320',
    streamUrl: 'https://icecast.astraradio.cz/320',
    title: 'Astra Radio 320',
    artist: 'Astra Radio',
    artwork: 'https://icecast.astraradio.cz/nowplaying.jpg',
    mount: '320',
    quality: 'AAC 320 kbps',
  },
  {
    id: 'astra-128',
    name: 'Astra Radio 128',
    streamUrl: 'https://icecast.astraradio.cz/128',
    title: 'Astra Radio 128',
    artist: 'Astra Radio',
    artwork: 'https://icecast.astraradio.cz/nowplaying.jpg',
    mount: '128',
    quality: 'AAC 128 kbps',
  },
  {
    id: 'astra-192',
    name: 'Astra Radio 192',
    streamUrl: 'https://icecast.astraradio.cz/192',
    title: 'Astra Radio 192',
    artist: 'Astra Radio',
    artwork: 'https://icecast.astraradio.cz/nowplaying.jpg',
    mount: '192',
    quality: 'AAC 192 kbps',
  },
];

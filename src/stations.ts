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
    id: 'astra-1',
    name: 'Astra Radio 320',
    streamUrl: 'https://astra.icecast.cz/320',
    title: 'Astra Radio 320',
    artist: 'Live',
    mount: '320',
    quality: 'MP3 320 kbps',
  },
  {
    id: 'astra-2',
    name: 'Astra Radio 120',
    streamUrl: 'https://astra.icecast.cz/1',
    title: 'Astra Radio 1',
    artist: 'Live',
    mount: '1',
    quality: 'AAC 128 kbps',
  },
  {
    id: 'astra-3',
    name: 'Astra Radio 64',
    streamUrl: 'https://astra.icecast.cz/mobile',
    title: 'Astra Radio Mobile',
    artist: 'Live',
    mount: 'mobile',
    quality: 'AAC+ 64 kbps',
  },
];

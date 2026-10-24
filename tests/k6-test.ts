import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    stampede_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 500 },
        { duration: '5s', target: 1000 },
      ],
      gracefulRampDown: '0s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<550'],
  },
};

export default function () {
  const res = http.get('http://127.0.0.1:1928/products/iphone-16');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
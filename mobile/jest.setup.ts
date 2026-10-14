import { configure } from '@testing-library/react-native';

// A cold Babel/Metro transform cache can make the first render slower than the 1s default.
configure({ asyncUtilTimeout: 10000 });
jest.setTimeout(30000);

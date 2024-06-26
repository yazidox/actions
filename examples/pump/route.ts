import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  VersionedTransaction,
} from '@solana/web3.js';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  actionSpecOpenApiPostRequestBody,
  actionsSpecOpenApiGetResponse,
  actionsSpecOpenApiPostResponse,
} from '../openapi';
import {
  ActionsSpecGetResponse,
  ActionsSpecPostRequestBody,
  ActionsSpecPostResponse,
} from '../../spec/actions-spec';
import { prepareTransaction } from '../transaction-utils';

const DONATION_DESTINATION_WALLET =
  '3h4AtoLTh3bWwaLhdtgQtcC3a3Tokb8NJbtqR9rhp7p6';
const DONATION_AMOUNT_SOL_OPTIONS = [0.01, 0.05, 0.1, 0.5, 1, 5];
const DEFAULT_DONATION_AMOUNT_SOL = 0.05;

const app = new OpenAPIHono();

app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Donate'],
    responses: actionsSpecOpenApiGetResponse,
  }),
  (c) => {
    const { icon, title, description } = getDonateInfo();
    const amountParameterName = 'amount';
    const response: ActionsSpecGetResponse = {
      icon,
      label: `${DEFAULT_DONATION_AMOUNT_SOL} SOL`,
      title,
      description,
      links: {
        actions: [
          ...DONATION_AMOUNT_SOL_OPTIONS.map((amount) => ({
            label: `${amount} SOL`,
            href: `/api/donate/${amount}`,
          })),
          {
            href: `/api/donate/{${amountParameterName}}`,
            label: 'Donate',
            parameters: [
              {
                name: amountParameterName,
                label: 'Enter a custom SOL amount',
              },
            ],
          },
        ],
      },
    };

    return c.json(response, 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/{mint}',
    tags: ['Pump'],
    request: {
      params: z.object({
        mint: z.string().openapi({
          param: {
            name: 'mint',
            in: 'path',
          },
          type: 'string',
          example: '5tPGNEeo2Gd29YMB92vRWye59Ya3RPWyar3MB6oQpump',
        }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  async (c) => {
    const mint = c.req.param('mint');
    console.log(mint);
    const amountParameterName = 'amount';
    const responsePump = await fetch(
      `https://pumpportal.fun/api/data/token-info?ca=${mint}`,
    );

    const dataPump = await responsePump.json();
    console.log(dataPump.data);

    // const { icon, title, description } = getDonateInfo();
    const response: ActionsSpecGetResponse = {
      icon: dataPump.data.image,
      label: `${mint}`,
      title: 'Buy ' + dataPump.data.name,
      description: dataPump.data.description,
      links: {
        actions: [
          ...DONATION_AMOUNT_SOL_OPTIONS.map((amount) => ({
            label: `${amount} SOL`,
            href: `/api/pump/${mint}/${amount}`,
          })),
          {
            href: `/api/pump/${mint}/{${amountParameterName}}`,
            label: 'Buy',
            parameters: [
              {
                name: amountParameterName,
                label: 'Enter a custom SOL amount',
              },
            ],
          },
        ],
      },
    };
    return c.json(response, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/{mint}/{amount}',
    tags: ['Pump'],
    request: {
      params: z.object({
        mint: z.string().openapi({
          param: {
            name: 'mint',
            in: 'path',
          },
          type: 'string',
          example: '5tPGNEeo2Gd29YMB92vRWye59Ya3RPWyar3MB6oQpump',
        }),
        amount: z
          .string()
          .optional()
          .openapi({
            param: {
              name: 'amount',
              in: 'path',
              required: false,
            },
            type: 'number',
            example: '1',
          }),
      }),
      body: actionSpecOpenApiPostRequestBody,
    },
    responses: actionsSpecOpenApiPostResponse,
  }),
  async (c) => {
    const mint = c.req.param('mint');
    console.log(mint);
    const amount =
      c.req.param('amount') ?? DEFAULT_DONATION_AMOUNT_SOL.toString();
    console.log(amount);
    const { account } = (await c.req.json()) as ActionsSpecPostRequestBody;
    const tx = await tradeToken(mint, 'buy', amount, new PublicKey(account));

    if (!tx) {
      console.log('Transaction failed');
      return c.json({ error: 'Transaction failed' }, 500);
    }
    console.log(tx);

    const response: ActionsSpecPostResponse = {
      transaction: Buffer.from(tx.serialize()).toString('base64'),
    };
    return c.json(response, 200);
  },
);

async function tradeToken(
  mint: string,
  action: 'buy',
  amount: number | string,
  userWallet: PublicKey,
): Promise<VersionedTransaction | null> {
  const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      publicKey: userWallet, // Your wallet public key
      action: action, // "buy"
      mint: mint, // contract address of the token you want to trade
      denominatedInSol: 'true', // "true" if amount is amount of SOL
      amount: amount, // amount of SOL
      slippage: 35, // percent slippage allowed
      priorityFee: '0.005', // priority fee
      pool: 'pump', // exchange to trade on. "pump" or "raydium"
    }),
  });

  if (response.status === 200) {
    const data = await response.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));

    return tx;
  } else {
    throw new Error(response.statusText);
  }
}

function getDonateInfo(): Pick<
  ActionsSpecGetResponse,
  'icon' | 'title' | 'description'
> {
  const icon =
    'https://ucarecdn.com/7aa46c85-08a4-4bc7-9376-88ec48bb1f43/-/preview/880x864/-/quality/smart/-/format/auto/';
  const title = 'Donate to Alice';
  const description =
    'Cybersecurity Enthusiast | Support my research with a donation.';
  return { icon, title, description };
}

export default app;

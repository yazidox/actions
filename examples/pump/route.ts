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
const DONATION_AMOUNT_SOL_OPTIONS = [1, 5, 10];
const DEFAULT_DONATION_AMOUNT_SOL = 1;

const app = new OpenAPIHono();

app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Donate'],
    responses: actionsSpecOpenApiGetResponse,
  }),
  (c) => {
    return c.json('Add mint to pump', 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/{mint}',
    tags: ['Donate'],
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
      title: 'Buy' + dataPump.data.name,
      description: dataPump.data.description,
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
    method: 'post',
    path: '/{mint}/{amount}',
    tags: ['Donate'],
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
    const amount =
      c.req.param('amount') ?? DEFAULT_DONATION_AMOUNT_SOL.toString();
    const { account } = (await c.req.json()) as ActionsSpecPostRequestBody;

    const parsedAmount = parseFloat(amount);
    const transaction = await prepareDonateTransaction(
      new PublicKey(account),
      new PublicKey(DONATION_DESTINATION_WALLET),
      parsedAmount * LAMPORTS_PER_SOL,
    );
    const response: ActionsSpecPostResponse = {
      transaction: Buffer.from(transaction.serialize()).toString('base64'),
    };
    return c.json(response, 200);
  },
);
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
async function prepareDonateTransaction(
  sender: PublicKey,
  recipient: PublicKey,
  lamports: number,
): Promise<VersionedTransaction> {
  const payer = new PublicKey(sender);
  const instructions = [
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: new PublicKey(recipient),
      lamports: lamports,
    }),
  ];
  return prepareTransaction(instructions, payer);
}

export default app;

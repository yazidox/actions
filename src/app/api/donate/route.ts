import { getDonateInfo, prepareDonateTransaction } from './utils';
import {
  ActionsSpecGetResponse,
  ActionsSpecPostRequestBody,
  ActionsSpecPostResponse
} from '../../spec/actions-spec';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  actionSpecOpenApiPostRequestBody,
  actionsSpecOpenApiGetResponse, actionsSpecOpenApiPostResponse
} from '../../openapi';

const DONATION_DESTINATION_WALLET =
  '3h4AtoLTh3bWwaLhdtgQtcC3a3Tokb8NJbtqR9rhp7p6';
const DONATION_AMOUNT_SOL_OPTIONS = [1, 5, 10];
const DEFAULT_DONATION_AMOUNT_SOL = 1;

const app = new OpenAPIHono();

app.openapi(createRoute({
  method: 'get',
  path: '/',
  tags: ['Donate'],
  responses: actionsSpecOpenApiGetResponse
}), (c) => {
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
          href: `/api/donate/${amount}`
        })),
        {
          href: `/api/donate/{${amountParameterName}}`,
          label: 'Donate',
          parameters: [
            {
              name: amountParameterName,
              label: 'Enter a custom SOL amount'
            }
          ]
        }
      ]
    }
  };

  return c.json(response, 200);
});

app.openapi(createRoute({
  method: 'get',
  path: '/{amount}',
  tags: ['Donate'],
  request: {
    params: z.object({
      amount: z.string().openapi({
        param: {
          name: 'amount',
          in: 'path'
        },
        type: 'number',
        example: '1'
      })
    })
  },
  responses: actionsSpecOpenApiGetResponse
}), (c) => {
  const amount = c.req.param('amount');
  const { icon, title, description } = getDonateInfo();
  const response: ActionsSpecGetResponse = {
    icon,
    label: `${amount} SOL`,
    title,
    description
  };
  return c.json(response, 200);
});

app.openapi(createRoute({
  method: 'post',
  path: '/{amount}',
  tags: ['Donate'],
  request: {
    params: z.object({
      amount: z.string().optional().openapi({
        param: {
          name: 'amount',
          in: 'path',
          required: false
        },
        type: 'number',
        example: '1'
      })
    }),
    body: actionSpecOpenApiPostRequestBody
  },
  responses: actionsSpecOpenApiPostResponse
}), async (c) => {
  const amount = c.req.param('amount') ?? DEFAULT_DONATION_AMOUNT_SOL.toString();
  const { account } = (await c.req.json()) as ActionsSpecPostRequestBody;

  const parsedAmount = parseFloat(amount);
  const transaction = await prepareDonateTransaction(
    new PublicKey(account),
    new PublicKey(DONATION_DESTINATION_WALLET),
    parsedAmount * LAMPORTS_PER_SOL
  );
  const response: ActionsSpecPostResponse = {
    transaction: Buffer.from(transaction.serialize()).toString('base64')
  };
  return c.json(response, 200);
});

export default app;
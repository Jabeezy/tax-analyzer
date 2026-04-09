const detectDocType = (text) => {
  const t = text.toLowerCase();
  if (t.includes('schedule e') || t.includes('supplemental income and loss')) return 'schedule_e';
  if (t.includes('schedule k-1') || t.includes("partner's share")) return 'k1';
  if (t.includes('form 1040') || t.includes('u.s. individual income tax return')) return '1040';
  if (t.includes('w-2') || t.includes('wage and tax statement') || t.includes('1099')) return 'w2_1099';
  return 'unknown';
};

const MOCK_RESPONSES = {
  schedule_e: {
    extracted_figures: {
      properties: [
        { address: '142 Maple St, Charlotte NC', rental_income: 24000, total_expenses: 18450, net_income: 5550 },
        { address: '88 River Rd, Concord NC', rental_income: 18600, total_expenses: 14200, net_income: 4400 }
      ],
      total_rental_income: 42600,
      total_expenses: 32650,
      total_net_income: 9950,
      depreciation_claimed: 8200,
      mortgage_interest: 11400
    },
    anomaly_flags: [
      {
        severity: 'high',
        field: 'Expense Ratio',
        message: 'Property at 142 Maple St has an expense ratio of 76.8%, significantly above the 55-65% typical range for residential rentals. Verify all deductions are legitimate and properly documented.'
      },
      {
        severity: 'medium',
        field: 'Depreciation',
        message: 'Depreciation of $8,200 appears low relative to reported property values. Confirm cost basis and depreciation schedule are current — a cost segregation study may unlock additional deductions.'
      }
    ],
    narrative_summary: 'This Schedule E reports two residential rental properties generating $42,600 in gross rental income for the tax year. After deducting $32,650 in allowable expenses, the taxpayer reports $9,950 in net rental income. The properties show consistent occupancy with no gaps in rental income reported. One property (142 Maple St) shows an elevated expense ratio that warrants a closer review of the supporting documentation before filing.',
    cpa_recommendations: [
      'Request receipts and invoices for all repair and maintenance expenses on 142 Maple St — the elevated expense ratio may trigger an IRS inquiry.',
      'Review depreciation schedules against original purchase prices to confirm the $8,200 figure is accurate. If properties were purchased before 2018, a cost segregation study could increase deductible depreciation significantly.',
      'Confirm that passive activity loss rules are being applied correctly if the taxpayer AGI exceeds $100,000.',
      'Verify that mortgage interest deductions match 1098 forms on file.'
    ],
    confidence_score: 0.91
  },

  k1: {
    extracted_figures: {
      partnership_name: 'Coastal Real Estate Partners LLC',
      partner_ein: '**-***4821',
      ownership_percentage: 22.5,
      ordinary_income: 31200,
      guaranteed_payments: 0,
      net_rental_income: 14800,
      capital_gains_long_term: 8500,
      section_179_deduction: 4200,
      distributions: 18000,
      beginning_capital: 142000,
      ending_capital: 168500
    },
    anomaly_flags: [
      {
        severity: 'medium',
        field: 'Distributions vs. Income',
        message: 'Distributions of $18,000 exceed reported net income allocation of $14,800 from rental activity. Verify this does not reduce the partner basis below zero, which would trigger gain recognition.'
      },
      {
        severity: 'low',
        field: 'Capital Account',
        message: 'Capital account increased by $26,500 — confirm this reconciles with reported income, contributions, and distributions. Request the partnership Schedule M-2 for verification.'
      }
    ],
    narrative_summary: 'This K-1 reflects a 22.5% ownership interest in Coastal Real Estate Partners LLC. The taxpayer share of income includes $31,200 in ordinary business income, $14,800 in net rental income, and $8,500 in long-term capital gains. The partnership also passed through a $4,200 Section 179 deduction. Capital account grew from $142,000 to $168,500 during the year, which is consistent with reported income minus distributions of $18,000.',
    cpa_recommendations: [
      'Perform a basis calculation before filing — distributions of $18,000 combined with any prior-year suspended losses could affect taxable gain recognition.',
      'Confirm the Section 179 deduction ($4,200) does not push the taxpayer total Section 179 claims over the annual limit when combined with other sources.',
      'Request the full partnership return (Form 1065) to verify that the K-1 figures match Schedule K.',
      'Review for any potential at-risk or passive activity limitations that apply to this partner situation.'
    ],
    confidence_score: 0.88
  },

  '1040': {
    extracted_figures: {
      filing_status: 'Married Filing Jointly',
      tax_year: '2023',
      wages: 148500,
      business_income: 31200,
      rental_income: 9950,
      capital_gains: 8500,
      agi: 189400,
      standard_deduction: 27700,
      taxable_income: 161700,
      total_tax: 28842,
      effective_tax_rate: '15.2%',
      withholding: 24100,
      refund_or_owed: { type: 'owed', amount: 4742 }
    },
    anomaly_flags: [
      {
        severity: 'high',
        field: 'Estimated Tax Penalty Risk',
        message: 'Taxpayer owes $4,742 with withholding of only $24,100. If no estimated tax payments were made, an underpayment penalty will likely apply. Review Form 2210 before filing.'
      },
      {
        severity: 'medium',
        field: 'Net Investment Income Tax',
        message: 'AGI of $189,400 is approaching the $200,000 MFJ threshold for the 3.8% Net Investment Income Tax. If rental and capital gain income increases next year, NIIT exposure should be modeled in advance.'
      }
    ],
    narrative_summary: 'This Form 1040 reflects a married couple filing jointly with total income from wages ($148,500), pass-through business income ($31,200), net rental income ($9,950), and long-term capital gains ($8,500), resulting in an AGI of $189,400. After the standard deduction, taxable income is $161,700 with a total federal tax liability of $28,842 and an effective rate of 15.2%. The return shows a balance due of $4,742 after withholding, with potential underpayment penalty exposure.',
    cpa_recommendations: [
      'File Form 2210 to determine whether the underpayment penalty applies and calculate its amount. Consider the annualized income installment method if income was not earned evenly throughout the year.',
      'Increase W-2 withholding or set up quarterly estimated payments for the current tax year to avoid a repeat shortfall.',
      'Model NIIT exposure for next year — rental income growth or additional capital events could push AGI above the $200K threshold.',
      'Evaluate whether itemizing deductions makes sense given Schedule A exposure from mortgage interest, state taxes, and charitable contributions reported elsewhere.'
    ],
    confidence_score: 0.94
  },

  w2_1099: {
    extracted_figures: {
      documents_detected: [
        { type: 'W-2', employer: 'Meridian Property Group', box1_wages: 148500, box2_federal_withheld: 22400, box4_ss_withheld: 9207, box6_medicare_withheld: 2153, box16_state_wages: 148500, box17_state_tax: 5890 },
        { type: '1099-INT', payer: 'First National Bank', box1_interest: 842 },
        { type: '1099-DIV', payer: 'Vanguard', box1a_total_dividends: 1240, box1b_qualified_dividends: 1240 }
      ],
      total_wages: 148500,
      total_federal_withheld: 22400,
      total_interest: 842,
      total_dividends: 1240
    },
    anomaly_flags: [
      {
        severity: 'medium',
        field: 'Withholding Rate',
        message: 'Federal withholding of $22,400 on wages of $148,500 represents a 15.1% effective withholding rate, which may be insufficient given additional income sources. Review total tax liability on Form 1040.'
      },
      {
        severity: 'low',
        field: 'Medicare Wages',
        message: 'Verify that Box 5 Medicare wages match Box 1 wages on the W-2. Discrepancies can indicate pre-tax benefit elections (HSA, 401k, FSA) that should be confirmed and documented.'
      }
    ],
    narrative_summary: 'This package includes one W-2 from Meridian Property Group reporting $148,500 in wages with $22,400 in federal withholding and $5,890 in state withholding. Additionally, a 1099-INT from First National Bank reports $842 in interest income, and a 1099-DIV from Vanguard reports $1,240 in qualified dividends. All income figures are consistent with prior-year trends. No red flags on the wage documents themselves — the withholding rate warrants review in the context of the full return.',
    cpa_recommendations: [
      'Cross-reference Box 12 codes on the W-2 for any pre-tax deductions (401k contributions, HSA, FSA) that affect adjusted gross income calculations.',
      'Confirm all qualified dividends from the 1099-DIV are eligible for the preferential 0%/15%/20% rate based on the taxpayer taxable income.',
      'If the taxpayer has additional 1099 income not in this package (freelance, consulting, etc.), ensure all sources are accounted for before filing.',
      'Review whether the state withholding of $5,890 is sufficient for the NC state return, especially with rental and investment income added.'
    ],
    confidence_score: 0.96
  },

  unknown: {
    extracted_figures: {},
    anomaly_flags: [
      {
        severity: 'high',
        field: 'Document Type',
        message: 'Could not identify this document as a supported tax form. Manual review required before analysis can proceed.'
      }
    ],
    narrative_summary: 'The document type could not be automatically determined from the extracted text. This may be due to a scanned image with poor text quality, a non-standard form, or a supporting document that is not directly analyzable as a primary tax form.',
    cpa_recommendations: [
      'Review the original document and re-upload as a text-selectable PDF if possible.',
      'If this is a supporting document, associate it manually with the relevant primary tax form in the system.',
      'Contact the client to confirm the document type and tax year it relates to.'
    ],
    confidence_score: 0.10
  }
};

const analyzeMock = async (docType, extractedText) => {
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
  return MOCK_RESPONSES[docType] || MOCK_RESPONSES['unknown'];
};

// LIVE — uncomment and swap analyzeMock for analyzeClaude when ready
// const Anthropic = require('@anthropic-ai/sdk');
// const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// const analyzeClaude = async (docType, extractedText) => {
//   const systemPrompt = `You are a tax document analyzer for a CPA firm specializing in real estate investors.
//   Return a JSON object with keys: extracted_figures, anomaly_flags, narrative_summary, cpa_recommendations, confidence_score.
//   Respond with valid JSON only.`;
//   const message = await client.messages.create({
//     model: 'claude-sonnet-4-20250514',
//     max_tokens: 1500,
//     messages: [{ role: 'user', content: `Document type: ${docType}\n\nExtracted text:\n${extractedText.slice(0, 8000)}` }],
//     system: systemPrompt
//   });
//   const raw = message.content[0].text;
//   return JSON.parse(raw.replace(/```json|```/g, '').trim());
// };

const analyzeDocument = async (extractedText) => {
  const docType = detectDocType(extractedText);
  const result = await analyzeMock(docType, extractedText);
  return { docType, ...result };
};

module.exports = { analyzeDocument, detectDocType };
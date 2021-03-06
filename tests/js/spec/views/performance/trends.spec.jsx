import React from 'react';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import PerformanceLanding from 'app/views/performance/landing';
import ProjectsStore from 'app/stores/projectsStore';
import {
  TRENDS_FUNCTIONS,
  getTrendAliasedFieldDivide,
  getTrendAliasedQueryDivide,
} from 'app/views/performance/trends/utils';
import {TrendFunctionField} from 'app/views/performance/trends/types';

const trendsViewQuery = {
  view: 'TRENDS',
};

function selectTrendFunction(wrapper, field) {
  const menu = wrapper.find('TrendsDropdown DropdownMenu');
  expect(menu).toHaveLength(1);
  menu.find('DropdownButton').simulate('click');

  const option = menu.find(`DropdownItem[data-test-id="${field}"] span`);
  expect(option).toHaveLength(1);
  option.simulate('click');

  wrapper.update();
}

function initializeData(projects, query) {
  const features = ['transaction-event', 'performance-view', 'internal-catchall'];
  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {...trendsViewQuery, ...query},
      },
    },
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return initialData;
}

describe('Performance > Trends', function() {
  let trendsMock;
  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    trendsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-trends/',
      body: {
        stats: {
          'internal,/organizations/:orgId/performance/': {
            data: [[123, []]],
          },
          order: 0,
        },
        events: {
          meta: {
            count_range_1: 'integer',
            count_range_2: 'integer',
            divide_count_range_2_count_range_1: 'percentage',
            divide_percentile_range_2_percentile_range_1: 'percentage',
            minus_percentile_range_2_percentile_range_1: 'number',
            percentile_range_1: 'duration',
            percentile_range_2: 'duration',
            transaction: 'string',
          },
          data: [
            {
              count: 8,
              project: 'internal',
              count_range_1: 2,
              count_range_2: 6,
              divide_count_range_2_count_range_1: 3,
              divide_percentile_range_2_percentile_range_1: 1.9235225955967554,
              minus_percentile_range_2_percentile_range_1: 797,
              percentile_range_1: 863,
              percentile_range_2: 1660,
              transaction: '/organizations/:orgId/performance/',
            },
            {
              count: 60,
              project: 'internal',
              count_range_1: 20,
              count_range_2: 40,
              divide_count_range_2_count_range_1: 2,
              divide_percentile_range_2_percentile_range_1: 1.204968944099379,
              minus_percentile_range_2_percentile_range_1: 66,
              percentile_range_1: 322,
              percentile_range_2: 388,
              transaction: '/api/0/internal/health/',
            },
          ],
        },
      },
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders basic UI elements', async function() {
    const projects = [TestStubs.Project()];
    const data = initializeData(projects, {});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    // Trends dropdown and transaction widgets should render.
    expect(wrapper.find('TrendsDropdown')).toHaveLength(1);
    expect(wrapper.find('ChangedTransactions')).toHaveLength(2);
  });

  it('transaction list items are rendered', async function() {
    const projects = [TestStubs.Project()];
    const data = initializeData(projects, {project: ['-1']});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('TrendsListItem')).toHaveLength(4);
  });

  it('clicking transaction link links to the correct view', async function() {
    const projects = [TestStubs.Project({id: 1, slug: 'internal'}), TestStubs.Project()];
    const data = initializeData(projects, {project: ['1']});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    const firstTransaction = wrapper.find('TrendsListItem').first();
    const transactionLink = firstTransaction.find('StyledLink');
    expect(transactionLink).toHaveLength(1);

    expect(transactionLink.text()).toEqual('/organizations/:orgId/performance/');
    expect(transactionLink.props().to.pathname).toEqual(
      '/organizations/org-slug/performance/summary/'
    );
    expect(transactionLink.props().to.query.project).toEqual(1);
  });

  it('transaction list renders user misery', async function() {
    const projects = [TestStubs.Project()];
    const data = initializeData(projects, {project: ['-1']});

    const location = {
      query: {...trendsViewQuery, trendFunction: TrendFunctionField.USER_MISERY},
    };
    const wrapper = mountWithTheme(
      <PerformanceLanding organization={data.organization} location={location} />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    const firstTransaction = wrapper.find('TrendsListItem').first();
    expect(firstTransaction.find('ItemTransactionAbsoluteFaster').text()).toMatch(
      '863 → 1.6k miserable users'
    );
    expect(firstTransaction.find('ItemTransactionPercentFaster').text()).toMatch(
      '797 less'
    );
  });

  it('choosing a trend function changes location', async function() {
    const projects = [TestStubs.Project()];
    const data = initializeData(projects, {project: ['-1']});
    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    for (const trendFunction of TRENDS_FUNCTIONS) {
      selectTrendFunction(wrapper, trendFunction.field);
      await tick();

      expect(browserHistory.push).toHaveBeenCalledWith({
        query: expect.objectContaining({
          trendFunction: trendFunction.field,
        }),
      });
    }
  });

  it('trend functions in location make api calls', async function() {
    const projects = [TestStubs.Project(), TestStubs.Project()];
    const data = initializeData(projects, {project: ['-1']});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    for (const trendFunction of TRENDS_FUNCTIONS) {
      trendsMock.mockReset();
      wrapper.setProps({
        location: {query: {...trendsViewQuery, trendFunction: trendFunction.field}},
      });
      wrapper.update();
      await tick();

      expect(trendsMock).toHaveBeenCalledTimes(2);

      const aliasedFieldDivide = getTrendAliasedFieldDivide(trendFunction.alias);
      const aliasedQueryDivide = getTrendAliasedQueryDivide(trendFunction.alias);

      // Improved trends call
      expect(trendsMock).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            trendFunction: trendFunction.field,
            sort: aliasedFieldDivide,
            query: expect.stringContaining(aliasedQueryDivide + ':<1'),
          }),
        })
      );

      // Regression trends call
      expect(trendsMock).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            trendFunction: trendFunction.field,
            sort: '-' + aliasedFieldDivide,
            query: expect.stringContaining(aliasedQueryDivide + ':>1'),
          }),
        })
      );
    }
  });
});
